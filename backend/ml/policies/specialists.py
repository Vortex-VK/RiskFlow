from typing import Any

import numpy as np

from ml.policies.thresholds import alerts, propagate


def nearby(
    frame: Any, seeds: Any, base_scores: Any, seed_threshold: float, hours: int, margin: float
) -> Any:
    initial = np.asarray(seeds, dtype=bool)
    values = np.asarray(base_scores, dtype=float)
    if initial.shape != (len(frame),) or values.shape != initial.shape:
        raise ValueError("Misaligned rescue population.")
    if not np.isfinite(values).all() or not np.isfinite(seed_threshold):
        raise ValueError("Invalid rescue scores.")
    if hours <= 0 or margin < 0 or not np.isfinite(margin):
        raise ValueError("Invalid rescue window.")
    neighbors = propagate(frame, initial.astype(float), 1.0, hours, 1.0)
    return ~initial & neighbors & (values >= seed_threshold - margin)


def apply(frame: Any, seeds: Any, scores: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    base = np.asarray(seeds, dtype=bool)
    if base.shape != (len(frame),):
        raise ValueError("Misaligned incumbent decisions.")
    for values in scores.values():
        if np.asarray(values).shape != base.shape or not np.isfinite(values).all():
            raise ValueError("Misaligned or invalid model scores.")
    online = (frame["channel"] == "Online Transaction").to_numpy()
    ebm = online & alerts(scores["online_ebm"], policy["online_ebm"])
    cb = online & alerts(scores["online_cb"], policy["online_cb"])
    consensus = online & alerts(scores["online_ebm"], policy["consensus_ebm"])
    consensus &= alerts(scores["online_cb"], policy["consensus_cb"])
    burst = policy["burst"]
    eligible = nearby(
        frame, base, scores["baseline"], policy["seed_threshold"], burst["hours"], burst["margin"]
    )
    rescued = eligible & alerts(scores["cb"], burst["threshold"])
    return {
        "baseline": base.copy(),
        "online_ebm": base | ebm,
        "online_cb": base | cb,
        "online_consensus": base | consensus,
        "online_union": base | ebm | cb,
        "seeded_rescue": base | rescued,
        "seeded_online_union": base | rescued | ebm | cb,
    }
