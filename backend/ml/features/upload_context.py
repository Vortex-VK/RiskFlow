"""Observable location and timing context, using strictly earlier upload events."""

from collections import deque
from itertools import groupby
from typing import Any

import numpy as np

from app.schemas.scenario import PaymentEvent

CATEGORICAL = ["merchant_state", "merchant_city"]
NUMERIC = [
    "minutes_since_previous",
    "minutes_since_previous_location",
    "previous_state_changed",
    "previous_city_changed",
    "location_seen_before",
    "minutes_since_location_seen",
    "distinct_locations_24h",
    "location_attempts_1h",
    "current_completed",
]
FEATURES = CATEGORICAL + NUMERIC


def feature_frame(payments: list[PaymentEvent]) -> Any:
    from app.domain.model_inputs import feature_frame as base_frame

    return augment(base_frame(payments), payments)


def augment(frame: Any, payments: list[PaymentEvent]) -> Any:
    data = frame.copy()
    inputs = {p.id: p.model_input for p in payments}
    if len(inputs) != len(payments) or not data.id.isin(inputs).all():
        raise ValueError("Unique matching payment identities required")
    states, cities, completed = [], [], []
    for identifier in data.id:
        value = inputs[identifier]
        if value is None:
            raise ValueError("Model input required")
        states.append(value.merchant_state.strip().upper() or "__MISSING__")
        cities.append(value.merchant_city.strip().upper() or "__MISSING__")
        completed.append(float(value.completed))
    data["merchant_state"], data["merchant_city"] = states, cities
    data["current_completed"] = completed
    return transitions(data)


def transitions(frame: Any) -> Any:
    """Raw locations are inputs, never account IDs, outcomes or future observations."""
    data = frame.copy()
    if "upload" not in data:
        data["upload"] = "submitted-file"
    times = data.seconds.to_numpy(dtype=float)
    if not np.isfinite(times).all():
        raise ValueError("Finite timestamps required")
    states = data.merchant_state.to_numpy()
    cities = data.merchant_city.to_numpy()
    channels = data.channel.to_numpy()
    result = np.full((len(data), len(NUMERIC) - 1), np.nan, dtype=np.float32)
    for indices in data.groupby(["upload", "account"], sort=False).indices.values():
        previous_time = None
        previous_locations: set[tuple[str, str]] = set()
        previous_location_time = None
        seen: dict[tuple[str, str], float] = {}
        queue: Any = deque()
        for now, batch in groupby(sorted(indices, key=lambda i: times[i]), key=lambda i: times[i]):
            current = list(batch)
            while queue and queue[0][0] < now - 86400:
                queue.popleft()
            locations = set()
            observations = []
            for i in current:
                valid = (
                    channels[i] != "Online Transaction"
                    and states[i] != "__MISSING__"
                    and cities[i] not in ("__MISSING__", "ONLINE")
                )
                key = (states[i], cities[i])
                prior = seen.get(key) if valid else None
                result[i] = [
                    (now - previous_time) / 60 if previous_time is not None else np.nan,
                    (now - previous_location_time) / 60
                    if previous_location_time is not None
                    else np.nan,
                    float(all(s != states[i] for s, _ in previous_locations))
                    if valid and previous_locations
                    else np.nan,
                    float(key not in previous_locations)
                    if valid and previous_locations
                    else np.nan,
                    float(prior is not None) if valid else np.nan,
                    (now - prior) / 60 if prior is not None else np.nan,
                    len({k for _, k in queue}),
                    sum(k == key and t >= now - 3600 for t, k in queue) if valid else np.nan,
                ]
                if valid:
                    locations.add(key)
                    observations.append(key)
            # Equal-time observations never influence one another, regardless of input order.
            for key in observations:
                seen[key] = now
                queue.append((now, key))
            if locations:
                previous_locations, previous_location_time = locations, now
            previous_time = now
    data[NUMERIC[:-1]] = result
    return data
