from typing import Any

import numpy as np

from ml.estimators import raw_scores


def check_values(values: Any) -> dict[str, float]:
    scores = np.asarray(values, dtype=float)
    if not scores.size or not np.isfinite(scores).all():
        raise ValueError("Nonfinite or empty model scores.")
    maximum = float(np.max(np.abs(scores)))
    if maximum > 1000.0:
        raise ValueError("Numerically unstable finite scores; reject model instead of clipping.")
    return {"maximum_absolute_score": maximum}


def score(model: Any, config: dict[str, Any], frame: Any) -> Any:
    values = raw_scores(model, config, frame)
    check_values(values)
    return values
