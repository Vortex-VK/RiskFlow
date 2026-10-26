"""Strictly prior model-margin histories, reset for every submitted upload.

These are prediction histories, not fraud-label histories or probabilities.
"""

import math
from collections import deque
from itertools import groupby
from typing import Any

import numpy as np

WINDOWS = {"1h": 3600, "24h": 86400, "7d": 604800}
FEATURES = [
    f"prior_margin_{stat}_{window}"
    for window in WINDOWS
    for stat in ("count", "mean", "max", "positive_fraction")
] + ["hours_since_positive_margin"]


def score_history(frame: Any, margins: Any) -> Any:
    """Return features in original row order; only account, upload and time are read."""
    values = np.asarray(margins, dtype=float)
    if values.shape != (len(frame),) or not np.isfinite(values).all():
        raise ValueError("Margin histories require aligned finite scores")
    seconds = frame.seconds.to_numpy(dtype=float)
    if not np.isfinite(seconds).all() or frame[["upload", "account"]].isna().any().any():
        raise ValueError("History identity and time must be present")
    result = np.full((len(frame), len(FEATURES)), np.nan, dtype=np.float32)
    for _, indices in frame.groupby(["upload", "account"], sort=False).indices.items():
        ordered = sorted(indices, key=lambda i: seconds[i])
        queues: dict[str, Any] = {name: deque() for name in WINDOWS}
        last_positive = None
        for now, batch in groupby(ordered, key=lambda i: seconds[i]):
            current = list(batch)
            features = []
            for name, duration in WINDOWS.items():
                queue = queues[name]
                while queue and queue[0][0] < now - duration:
                    queue.popleft()
                prior = [score for _, score in queue]
                features.extend(
                    [
                        len(prior),
                        sum(prior) / len(prior) if prior else math.nan,
                        max(prior) if prior else math.nan,
                        sum(v > 0 for v in prior) / len(prior) if prior else math.nan,
                    ]
                )
            features.append((now - last_positive) / 3600 if last_positive is not None else math.nan)
            result[current] = features
            # Whole equal-time batches cannot influence one another.
            for i in current:
                for queue in queues.values():
                    queue.append((now, values[i]))
            if any(values[i] > 0 for i in current):
                last_positive = now
    return result
