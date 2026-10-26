"""Hash-checked learned probability output models, independent of alert decisions."""

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from ml.artifacts import digest
from ml.card_priority_runtime import MANIFEST_SHA256 as REVIEW_SHA
from ml.precision_runtime import MANIFEST_SHA256 as V8_SHA
from ml.probability_math import EPSILON, predict
from ml.runtime import ModelUnavailable

VERSION = "fraud-probability-v1"
BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/probability-v1"
MANIFEST_SHA256 = "c502560911caa3464ce7cadf5a662a0d4200d74a86c456614061bac272ca197f"


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("Probability package hash mismatch")
            self.manifest: dict[str, Any] = json.loads((directory / "manifest.json").read_text())
            if (
                self.manifest["version"] != VERSION
                or self.manifest["v8_sha256"] != V8_SHA
                or self.manifest["review_sha256"] != REVIEW_SHA
                or self.manifest["epsilon"] != EPSILON
            ):
                raise ValueError("Probability model dependencies changed")
            for mapping in self.manifest["sources"].values():
                if mapping["method"] != "sigmoid" or mapping["slope"] <= 0:
                    raise ValueError("Supported monotone probability mapping required")
                if not all(math.isfinite(mapping[k]) for k in ("slope", "intercept", "raw_cutoff")):
                    raise ValueError("Finite probability parameters required")
                # libm/NumPy may differ in the final floating-point bits across OSes.
                # Artifact bytes and learned parameters remain strictly hash-checked.
                if not math.isclose(
                    float(predict(mapping, [mapping["raw_cutoff"]])[0]),
                    mapping["reference_probability"],
                    rel_tol=1e-14,
                    abs_tol=1e-15,
                ):
                    raise ValueError("Reference probability mismatch")
        except Exception as exc:
            raise ModelUnavailable(
                "Trained probability package is missing or incompatible."
            ) from exc

    def probability(self, margin: float, source: str) -> float:
        try:
            return float(predict(self.manifest["sources"][source], [margin])[0])
        except Exception as exc:
            raise ModelUnavailable("Probability inference failed.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    return Runtime()
