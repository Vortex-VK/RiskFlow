from collections import Counter, defaultdict, deque
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from itertools import groupby
from typing import Any

import numpy as np

GEO_FEATURES = [
    "merchant_geo_available",
    "geo_history_count",
    "state_frequency_90d",
    "city_frequency_90d",
    "zip_frequency_90d",
    "distinct_states_90d",
    "state_recency_days",
]

FEEDBACK_FEATURES = ["merchant_matured_count", "merchant_matured_fraud", "merchant_matured_rate"]

DAY = 86400


@dataclass(frozen=True)
class GeoEvent:
    id: str
    account: str
    timestamp: float
    state: str
    city: str
    zip: str
    channel: str


def location(row: GeoEvent) -> tuple[str, str, str] | None:
    state, city, zipcode = (v.strip().upper() for v in (row.state, row.city, row.zip))
    if row.channel == "Online Transaction" or not state or not city or city == "ONLINE":
        return None
    return state, state + "|" + city, state + "|" + zipcode if zipcode else ""


def geo_rows(rows: Iterable[GeoEvent]) -> Iterator[tuple[str, list[float]]]:
    history: dict[str, Any] = defaultdict(deque)
    counts: dict[str, list[Counter[str]]] = defaultdict(lambda: [Counter(), Counter(), Counter()])
    last: dict[str, dict[str, float]] = defaultdict(dict)
    previous = -float("inf")
    for now, batch in groupby(rows, key=lambda r: r.timestamp):
        if now < previous:
            raise ValueError("Geography requires chronological input.")
        previous = now
        current = list(batch)
        for row in current:
            queue, counters = history[row.account], counts[row.account]
            while queue and queue[0][0] < now - 90 * DAY:
                _, keys = queue.popleft()
                for counter, key in zip(counters, keys, strict=True):
                    if key:
                        counter[key] -= 1
                        if counter[key] == 0:
                            del counter[key]
                if keys[0] not in counters[0]:
                    last[row.account].pop(keys[0], None)
            keys = location(row)
            total = len(queue)
            values = [float(keys is not None), float(total)]
            values += [
                counter[key] / total if total and key else float("nan")
                for counter, key in zip(counters, keys or ("", "", ""), strict=True)
            ]
            seen = last[row.account].get(keys[0]) if keys else None
            values += [
                float(len(counters[0])),
                (now - seen) / DAY if seen is not None else float("nan"),
            ]
            yield row.id, values
        for row in current:
            keys = location(row)
            if keys:
                history[row.account].append((now, keys))
                for counter, key in zip(counts[row.account], keys, strict=True):
                    if key:
                        counter[key] += 1
                last[row.account][keys[0]] = now


def mature_features(history: Any, targets: Any, delay: int) -> Any:
    if delay < 1:
        raise ValueError("Reporting delay must be positive.")
    result = np.zeros((len(targets), 3), dtype=np.float32)
    end = targets["seconds"].to_numpy() - delay * DAY
    start = end - 90 * DAY
    ordered = history.sort_values("seconds", kind="stable")
    times = ordered["seconds"].to_numpy()
    positives = np.r_[0, ordered["label"].to_numpy().cumsum()]
    lo, hi = np.searchsorted(times, start, side="left"), np.searchsorted(times, end, side="left")
    prior = np.divide(
        positives[hi] - positives[lo],
        hi - lo,
        out=np.zeros(len(targets), dtype=float),
        where=hi > lo,
    )
    result[:, 2] = prior
    groups = {k: v for k, v in ordered.groupby("merchant", sort=False)}
    for merchant, indices in targets.groupby("merchant", sort=False).indices.items():
        group = groups.get(merchant)
        if group is None:
            continue
        t = group["seconds"].to_numpy()
        p = np.r_[0, group["label"].to_numpy().cumsum()]
        left = np.searchsorted(t, start[indices], side="left")
        right = np.searchsorted(t, end[indices], side="left")
        n, fraud = right - left, p[right] - p[left]
        result[indices, 0] = n
        result[indices, 1] = fraud
        result[indices, 2] = (fraud + 20 * prior[indices]) / (n + 20)
    return result
