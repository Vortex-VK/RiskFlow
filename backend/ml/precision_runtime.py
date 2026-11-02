"""Frozen Upload-v8 precision policy; separate review tools cannot alter its decisions."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier

from ml.artifacts import digest
from ml.coverage_runtime import MANIFEST_SHA256 as CARD_SHA256
from ml.coverage_runtime import Runtime as CardRuntime
from ml.runtime import LOCK, ModelUnavailable

BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/upload-v8"
MANIFEST_SHA256 = "da7bfaa47a98c4034f2226d67e25195e478b49b57baba71f4cdbc7ac6846e606"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("V8 manifest mismatch")
            self.manifest = json.loads((directory / "manifest.json").read_text())
            if self.manifest["card_dependency_sha256"] != CARD_SHA256:
                raise ValueError("Card dependency changed")
            self.cards = CardRuntime(directory.parent / "upload-v7")
            entry = self.manifest["online_model"]
            path = directory / entry["file"]
            if path.parent != directory or digest(path) != entry["sha256"]:
                raise ValueError("V8 model mismatch")
            self.online = CatBoostClassifier()
            self.online.load_model(str(path))
        except Exception as exc:
            raise ModelUnavailable("Upload-v8 package is missing or incompatible.") from exc

    def predict(self, frame: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            with LOCK:
                scores, previous = self.cards.predict(frame)
                online = self.online.predict(
                    frame[self.manifest["features"]],
                    prediction_type="RawFormulaVal",
                    thread_count=2,
                )
                if not np.isfinite(online).all():
                    raise ValueError("Nonfinite online margin")
                paths = {
                    "coverage": previous["coverage"],
                    "online_specialist": frame.channel.eq("Online Transaction").to_numpy()
                    & (online >= self.manifest["threshold"]),
                }
                paths["alert"] = paths["coverage"] | paths["online_specialist"]
                return {**scores, "online_specialist": online}, paths
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Upload-v8 inference failed; no fallback was produced.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
