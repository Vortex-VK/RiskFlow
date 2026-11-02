"""Prioritize frozen v1 review leads; never drop a lead or alter Upload-v8 alerts."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier

from ml.artifacts import digest
from ml.card_pattern_runtime import MANIFEST_SHA256 as PROPOSAL_SHA256
from ml.card_pattern_runtime import Runtime as ProposalRuntime
from ml.runtime import LOCK, ModelUnavailable

BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/card-pattern-v5"
MANIFEST_SHA256 = "47db3ad7245bcb988d3ea22b575771b9a5bd8536eec1a96c9af71386b0195b97"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("Priority manifest mismatch")
            self.manifest = json.loads((directory / "manifest.json").read_text())
            if self.manifest["proposal_bundle_sha256"] != PROPOSAL_SHA256:
                raise ValueError("Proposal dependency changed")
            self.proposals = ProposalRuntime(directory.parent / "card-pattern-v1")
            entry = self.manifest["priority_model"]
            path = directory / entry["file"]
            if path.parent != directory or digest(path) != entry["sha256"]:
                raise ValueError("Priority model mismatch")
            self.priority_model = CatBoostClassifier()
            self.priority_model.load_model(str(path))
        except Exception as exc:
            raise ModelUnavailable("Card review priority package is unavailable.") from exc

    def predict(self, frame: Any, model_alerts: Any) -> tuple[Any, Any]:
        return self.proposals.predict(frame, model_alerts)

    def prioritize(self, frame: Any, proposals: Any) -> tuple[Any, Any]:
        try:
            with LOCK:
                scores = np.asarray(
                    self.priority_model.predict(
                        frame[self.manifest["priority_features"]],
                        prediction_type="RawFormulaVal",
                        thread_count=2,
                    )
                )
                flags = np.asarray(proposals, dtype=bool)
                if scores.shape != (len(frame),) or flags.shape != scores.shape:
                    raise ValueError("Aligned review priority outputs required")
                if not np.isfinite(scores).all():
                    raise ValueError("Finite priority margins required")
                return scores, flags & (scores >= self.manifest["priority_threshold"])
        except Exception as exc:
            raise ModelUnavailable("Card review prioritization failed.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
