"""Frozen mixed IBM/authored probability head, installed by explicit user selection."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier

from ml.artifacts import digest
from ml.card_priority_runtime import MANIFEST_SHA256 as REVIEW_SHA
from ml.card_priority_runtime import Runtime as ReviewRuntime
from ml.precision_runtime import MANIFEST_SHA256 as V8_SHA
from ml.precision_runtime import Runtime as V8Runtime
from ml.runtime import LOCK, ModelUnavailable

BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/upload-v9"
MANIFEST_SHA256 = "58c9c2497c36ccd85c1553214ed104713d174dd4970ea6553f72bb8498495e67"
VERSION = "fraud-probability-v2"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("Adaptation manifest mismatch")
            self.manifest: dict[str, Any] = json.loads((directory / "manifest.json").read_text())
            if self.manifest["v8_sha256"] != V8_SHA or self.manifest["review_sha256"] != REVIEW_SHA:
                raise ValueError("Adaptation dependencies changed")
            self.base = V8Runtime(directory.parent / "upload-v8")
            self.reviewer = ReviewRuntime(directory.parent / "card-pattern-v5")
            entry = self.manifest["model"]
            path = directory / entry["file"]
            if path.parent != directory or digest(path) != entry["sha256"]:
                raise ValueError("Adaptation model mismatch")
            self.model = CatBoostClassifier()
            self.model.load_model(str(path))
            if self.model.feature_names_ != self.manifest["features"]:
                raise ValueError("Adaptation feature contract mismatch")
        except Exception as exc:
            raise ModelUnavailable("Upload-v9 package is missing or incompatible.") from exc

    def probability(self, margins: Any) -> Any:
        raw = np.asarray(margins, dtype=float)
        if not np.isfinite(raw).all():
            raise ModelUnavailable("Finite adaptation margins required.")
        z = np.clip(self.manifest["slope"] * raw + self.manifest["intercept"], -35, 35)
        return 1 / (1 + np.exp(-z))

    def predict(self, frame: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            with LOCK:
                scores, old_paths = self.base.predict(frame)
                pattern, proposals = self.reviewer.predict(frame, old_paths["alert"])
                priority, _ = self.reviewer.prioritize(frame, proposals)
                online = frame.channel.eq("Online Transaction").to_numpy()
                eligible = ~online & frame.history_samples.ge(10).to_numpy()
                data = frame.copy()
                data["v8_margin"] = np.where(
                    online, scores["online_specialist"], scores["coverage"]
                )
                data["pattern_margin"] = np.where(eligible, pattern, np.nan)
                data["priority_margin"] = np.where(eligible, priority, np.nan)
                raw = np.asarray(
                    self.model.predict(
                        data[self.manifest["features"]],
                        prediction_type="RawFormulaVal",
                        thread_count=2,
                    ),
                    dtype=float,
                )
                p = self.probability(raw)
                paths = {
                    "adapted_card": ~online
                    & (p >= self.manifest["sources"]["adapted_card"]["reference_probability"]),
                    "adapted_online": online
                    & (p >= self.manifest["sources"]["adapted_online"]["reference_probability"]),
                }
                paths["alert"] = paths["adapted_card"] | paths["adapted_online"]
                return {**scores, "adapted_card": raw, "adapted_online": raw}, paths
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Upload-v9 inference failed; no fallback was produced.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
