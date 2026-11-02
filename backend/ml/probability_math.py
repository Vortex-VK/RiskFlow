"""Portable, deterministic probability mappings; no fitting at application runtime."""

from typing import Any

import numpy as np

EPSILON = 1e-6


def predict(mapping: dict[str, Any], margins: Any) -> Any:
    x = np.asarray(margins, dtype=float)
    if not np.isfinite(x).all():
        raise ValueError("Finite margins required")
    if mapping["method"] == "sigmoid":
        z = mapping["slope"] * x + mapping["intercept"]
        # Stable sigmoid, including extreme inputs.
        p = np.exp(-np.logaddexp(0.0, -z))
    elif mapping["method"] == "isotonic":
        p = np.interp(x, mapping["x"], mapping["y"])
    else:
        raise ValueError("Unknown probability mapping")
    return np.clip(p, EPSILON, 1 - EPSILON)
