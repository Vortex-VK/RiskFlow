from typing import Any

import numpy as np

from ml.policies.specialists import apply as apply_previous
from ml.policies.specialists import nearby
from ml.policies.thresholds import alerts


def apply(frame: Any, seeds: Any, scores: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    previous = apply_previous(frame, seeds, scores, policy["previous"])
    cutoff = policy["previous"]["online_cb"]
    episode = np.zeros(len(frame), dtype=bool)
    if cutoff is not None:
        online = (frame["channel"] == "Online Transaction").to_numpy()
        initial = online & alerts(scores["online_cb"], cutoff)
        burst = policy["online_burst"]
        episode = online & nearby(
            frame, initial, scores["online_cb"], cutoff, burst["hours"], burst["margin"]
        )
        episode &= alerts(scores["online_ebm"], burst["threshold"])
    followup = previous["seeded_rescue"] | previous["online_cb"]
    return {
        "baseline": previous["baseline"],
        "cb_followup": followup,
        "online_episode": previous["online_cb"] | episode,
        "combined": followup | episode,
    }
