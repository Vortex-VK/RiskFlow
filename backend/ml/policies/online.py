from typing import Any

import numpy as np

from ml.policies.specialists import nearby
from ml.policies.thresholds import alerts


def episode(frame: Any, source: Any, corroboration: Any, policy: dict[str, Any]) -> Any:
    cutoff = policy["cutoff"]
    online = (frame["channel"] == "Online Transaction").to_numpy()
    if cutoff is None:
        return np.zeros(len(frame), dtype=bool)
    seeds = online & alerts(source, cutoff)
    burst = policy["burst"]
    proposed = nearby(frame, seeds, source, cutoff, burst["hours"], burst["margin"])
    return seeds | (online & proposed & alerts(corroboration, burst["threshold"]))
