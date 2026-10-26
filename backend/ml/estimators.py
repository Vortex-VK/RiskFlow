from typing import Any

import numpy as np


def raw_scores(model: Any, config: dict[str, Any], frame: Any) -> Any:
    x = frame[config["features"]]
    scores = (
        model.predict(x, prediction_type="RawFormulaVal")
        if config["family"] == "catboost"
        else model.decision_function(x)
    )
    scores = np.asarray(scores, dtype=float)
    if not np.isfinite(scores).all():
        raise ValueError("Model returned nonfinite scores.")
    return scores
