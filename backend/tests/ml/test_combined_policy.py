from typing import Any

import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.policies.combined import apply


def policy() -> dict[str, Any]:
    return {
        "previous": {
            "online_ebm": None,
            "online_cb": 8,
            "consensus_ebm": None,
            "consensus_cb": None,
            "seed_threshold": 10,
            "burst": {"hours": 1, "margin": 4, "threshold": None},
        },
        "online_burst": {"hours": 1, "margin": 4, "threshold": 5},
    }


def test_online_episode_requires_online_seed_and_corroboration_without_recursion() -> None:
    frame = pd.DataFrame(
        {
            "account": ["a"] * 6 + ["b"] * 2,
            "seconds": [0, 0, 3500, 7000, 10, 20, 0, 30],
            "channel": ["Online Transaction"] * 4
            + ["Chip Transaction", "Online Transaction", "Chip Transaction", "Online Transaction"],
        }
    )
    scores = {
        "baseline": np.zeros(8),
        "cb": np.zeros(8),
        "online_cb": np.array([10, 6, 6, 6, 6, 6, 10, 6]),
        "online_ebm": np.array([10, 6, 6, 6, 6, 4, 10, 6]),
    }
    initial = np.array([False] * 6 + [True, False])
    result = apply(frame, initial, scores, policy())
    assert result["online_episode"].tolist() == [
        True,
        False,
        True,
        False,
        False,
        False,
        True,
        False,
    ]
    assert result["cb_followup"].tolist() == [True, False, False, False, False, False, True, False]
    assert all(v[6] for v in result.values())
    unsupported = policy()
    unsupported["previous"]["online_cb"] = None
    np.testing.assert_array_equal(apply(frame, initial, scores, unsupported)["combined"], initial)
