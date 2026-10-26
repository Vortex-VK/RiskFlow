"""Card-pattern scores used by the main probability head and separate review evidence."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier

from ml.artifacts import digest
from ml.runtime import LOCK, ModelUnavailable

BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/card-pattern-v1"
MANIFEST_SHA256 = "34ec3e0351fa2977a1614e58ae2bd727a652d4d988e7528849d4d0b6733e56a2"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("Review manifest mismatch")
            self.manifest = json.loads((directory / "manifest.json").read_text())
            entry = self.manifest["model"]
            path = directory / entry["file"]
            if path.parent != directory or digest(path) != entry["sha256"]:
                raise ValueError("Review model mismatch")
            if self.manifest["threshold"] is None:
                raise ValueError("Review cutoff was not supported")
            self.model = CatBoostClassifier()
            self.model.load_model(str(path))
        except Exception as exc:
            raise ModelUnavailable(
                "Card-pattern review package is missing or incompatible."
            ) from exc

    def predict(self, frame: Any, model_alerts: Any) -> tuple[Any, Any]:
        try:
            with LOCK:
                scores = self.model.predict(
                    frame[self.manifest["features"]],
                    prediction_type="RawFormulaVal",
                    thread_count=2,
                )
                if not np.isfinite(scores).all() or len(model_alerts) != len(frame):
                    raise ValueError("Aligned finite review outputs required")
                eligible = frame.channel.ne("Online Transaction").to_numpy() & (
                    frame.history_samples.to_numpy() >= self.manifest["minimum_completed_history"]
                )
                suggestions = (
                    eligible
                    & ~np.asarray(model_alerts, dtype=bool)
                    & (scores >= self.manifest["threshold"])
                )
                return scores, suggestions
        except Exception as exc:
            raise ModelUnavailable("Card-pattern review is unavailable for this run.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
