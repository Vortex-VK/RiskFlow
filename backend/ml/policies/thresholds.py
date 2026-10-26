from typing import Any

import numpy as np


def alerts(scores: Any, threshold: float | None) -> Any:
    values = np.asarray(scores, dtype=float)
    if values.ndim != 1 or not np.isfinite(values).all():
        raise ValueError("Invalid policy scores.")
    if threshold is not None and not np.isfinite(threshold):
        raise ValueError("Invalid policy threshold.")
    return np.zeros(len(values), dtype=bool) if threshold is None else values >= threshold


def propagate(frame: Any, scores: Any, threshold: float, hours: int, margin: float) -> Any:
    values = np.asarray(scores)
    initial = alerts(values, threshold)
    if hours < 0 or margin < 0:
        raise ValueError("Invalid propagation policy.")
    if not hours:
        return initial
    result = initial.copy()
    seconds = frame["seconds"].to_numpy()
    if len(frame) != len(values) or not np.isfinite(seconds).all():
        raise ValueError("Invalid propagation population.")
    for positions in frame.groupby("account", sort=False).indices.values():
        seed_times = np.sort(seconds[positions][initial[positions]])
        if not len(seed_times):
            continue
        previous = np.searchsorted(seed_times, seconds[positions], side="left") - 1
        elapsed = seconds[positions] - seed_times[np.maximum(previous, 0)]
        extra = (previous >= 0) & (elapsed <= hours * 3600)
        extra &= values[positions] >= threshold - margin
        result[positions] |= extra
    return result
