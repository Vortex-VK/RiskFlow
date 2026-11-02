import json
import pickle
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from threadpoolctl import threadpool_limits

from ml.artifacts import digest
from ml.common import LOCK as LOCK
from ml.common import ModelUnavailable as ModelUnavailable
from ml.models import score
from ml.policies.combined import apply as combined
from ml.policies.online import episode
from ml.policies.rescue import apply as rescue
from ml.policies.thresholds import alerts

MANIFEST_SHA256 = "62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046"
BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/v13"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            manifest = directory / "manifest.json"
            if digest(manifest) != MANIFEST_SHA256:
                raise ValueError("Inference manifest hash mismatch.")
            self.manifest = json.loads(manifest.read_text())
            self.models: dict[str, list[Any]] = {}
            for name, item in self.manifest["models"].items():
                self.models[name] = []
                for package in item["packages"]:
                    path = directory / package["file"]
                    if path.parent != directory or digest(path) != package["sha256"]:
                        raise ValueError("Inference model hash mismatch.")
                    self.models[name].append(pickle.loads(path.read_bytes()))
        except Exception as exc:
            raise ModelUnavailable("V13 model package is missing or incompatible.") from exc

    def predict(self, frame: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            with LOCK, threadpool_limits(limits=2):
                scores = {
                    name: np.mean(
                        [
                            score(model, self.manifest["models"][name]["configuration"], frame)
                            for model in models
                        ],
                        axis=0,
                    )
                    for name, models in self.models.items()
                }
                policy = self.manifest["policies"]
                cutoffs = policy["cb"]["cutoffs"]
                cb = np.zeros(len(frame), dtype=bool)
                for channel in frame["channel"].unique():
                    selected = (frame["channel"] == channel).to_numpy()
                    threshold = cutoffs["channels"].get(channel, cutoffs["global"])
                    cb[selected] = alerts(scores["cb"][selected], threshold)
                early = rescue(frame, scores["baseline"], scores["cb"], cb, policy["rescue"])
                previous = combined(frame, early["combined"], scores, policy["combined"])
                specialist = episode(
                    frame, scores["depth6"], scores["online_ebm"], policy["online"]
                )
                paths = {
                    "recent_model": early["baseline"],
                    "corroborated_history": early["combined"] & ~early["baseline"],
                    "online_history": previous["combined"] & ~early["combined"],
                    "online_depth6": specialist,
                }
                paths["alert"] = previous["combined"] | specialist
                return scores, paths
        except Exception as exc:
            raise ModelUnavailable("V13 inference failed; no fallback score was produced.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
