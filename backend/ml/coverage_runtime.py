"""Packaged upload-v7 inference; no research data or training modules are required."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier
from threadpoolctl import threadpool_limits

from ml.artifacts import digest
from ml.features.score_history import FEATURES, score_history
from ml.runtime import LOCK, ModelUnavailable
from ml.runtime import MANIFEST_SHA256 as LEGACY_SHA256
from ml.runtime import Runtime as LegacyRuntime

MANIFEST_SHA256 = "a4374bd76f8a67012f9ea5ae1ec4a87c51ae0f8c9b3db04080f5c2f73ee2bcfd"
BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/upload-v7"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            manifest = directory / "manifest.json"
            if digest(manifest) != MANIFEST_SHA256:
                raise ValueError("Inference manifest hash mismatch")
            self.manifest = json.loads(manifest.read_text())
            if (
                digest(Path(__file__).parent / "features/upload_context.py")
                != self.manifest["upload_context_sha256"]
            ):
                raise ValueError("Upload context implementation changed")
            if self.manifest["online_dependency"]["manifest_sha256"] != LEGACY_SHA256:
                raise ValueError("Online dependency changed")
            if (
                digest(Path(__file__).parent / "features/score_history.py")
                != self.manifest["score_history_sha256"]
            ):
                raise ValueError("Score-history implementation changed")

            def load(entry: dict[str, Any]) -> Any:
                path = directory / entry["file"]
                if path.parent != directory or digest(path) != entry["sha256"]:
                    raise ValueError("Inference model hash mismatch")
                model = CatBoostClassifier()
                model.load_model(str(path))
                return model

            self.teachers = {k: load(v) for k, v in self.manifest["teachers"].items()}
            self.models = [load(entry) for entry in self.manifest["models"]]
            self.online = LegacyRuntime(directory.parent / "v13")
        except Exception as exc:
            raise ModelUnavailable("Upload-v7 model package is missing or incompatible.") from exc

    def predict(self, frame: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            with LOCK, threadpool_limits(limits=2):
                data = frame.copy()
                if not data.channel.isin(
                    ["Chip Transaction", "Swipe Transaction", "Online Transaction"]
                ).all():
                    raise ValueError("Unsupported channel")
                if "upload" not in data:
                    data["upload"] = "submitted-file"
                card = data.channel.ne("Online Transaction").to_numpy()
                margins = np.zeros(len(data), dtype=float)
                for channel, model in self.teachers.items():
                    mask = data.channel.eq(channel).to_numpy()
                    if mask.any():
                        columns = self.manifest["teachers"][channel]["features"]
                        margins[mask] = model.predict(
                            data.loc[mask, columns], prediction_type="RawFormulaVal", thread_count=2
                        )
                data["base_margin"] = margins.astype(np.float32)
                history = np.full((len(data), len(FEATURES)), np.nan, dtype=np.float32)
                history[card] = score_history(data.loc[card], margins[card])
                data[FEATURES] = history
                coverage = np.mean(
                    [
                        model.predict(
                            data[self.manifest["features"]],
                            prediction_type="RawFormulaVal",
                            thread_count=2,
                        )
                        for model in self.models
                    ],
                    axis=0,
                )
                if not np.isfinite(coverage).all() or not np.isfinite(margins).all():
                    raise ValueError("Non-finite model margin")
                online = np.zeros(len(data), dtype=bool)
                legacy_scores = {
                    name: np.zeros(len(data), dtype=float) for name in self.online.models
                }
                for _, indices in data.groupby("upload", sort=False).indices.items():
                    values, paths = self.online.predict(data.iloc[indices])
                    online[indices] = paths["alert"]
                    for name, value in values.items():
                        legacy_scores[name][indices] = value
                paths = {
                    "coverage": card & (coverage >= self.manifest["threshold"]),
                    "retained_online": ~card & online,
                }
                paths["alert"] = paths["coverage"] | paths["retained_online"]
                return {**legacy_scores, "base_margin": margins, "coverage": coverage}, paths
        except Exception as exc:
            raise ModelUnavailable(
                "Upload-v7 inference failed; no fallback score was produced."
            ) from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
