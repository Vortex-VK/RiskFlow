from typing import Any

import numpy as np

from ml.policies.thresholds import alerts, propagate


def apply(
    frame: Any, base_scores: Any, cb_scores: Any, cb_alerts: Any, policy: dict[str, Any]
) -> dict[str, Any]:
    base = alerts(base_scores, policy["seed_threshold"])
    burst = policy["burst"]
    eligible = propagate(
        frame, base_scores, policy["seed_threshold"], burst["hours"], burst["margin"]
    )
    guarded = base | (eligible & alerts(cb_scores, burst["threshold"]))
    agreed = base | (np.asarray(cb_alerts, dtype=bool) & alerts(base_scores, policy["agreement"]))
    return {
        "baseline": base,
        "guarded_burst": guarded,
        "agreement": agreed,
        "combined": guarded | agreed,
    }
