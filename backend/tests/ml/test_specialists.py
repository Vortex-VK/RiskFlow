import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.policies.specialists import apply, nearby


def test_neighborhood_is_causal_nonrecursive_account_isolated_and_order_independent() -> None:
    frame = pd.DataFrame(
        {"account": ["a", "a", "a", "a", "b", "a"], "seconds": [0, 0, 3500, 7000, 100, -1]}
    )
    seeds = np.array([True, False, False, False, False, False])
    scores = np.array([10, 9, 9, 9, 9, 9])
    expected = np.array([False, False, True, False, False, False])
    np.testing.assert_array_equal(nearby(frame, seeds, scores, 10, 1, 4), expected)
    order = np.array([4, 2, 0, 5, 1, 3])
    np.testing.assert_array_equal(
        nearby(frame.iloc[order], seeds[order], scores[order], 10, 1, 4), expected[order]
    )
    scores[2] = 5
    assert not nearby(frame, seeds, scores, 10, 1, 4).any()


def test_additive_inference_is_channel_scoped_and_retains_incumbent_alerts() -> None:
    frame = pd.DataFrame(
        {
            "account": list("abcde"),
            "seconds": [0] * 5,
            "channel": [
                "Chip Transaction",
                "Online Transaction",
                "Online Transaction",
                "Chip Transaction",
                "Online Transaction",
            ],
        }
    )
    scores = {
        "baseline": np.zeros(5),
        "cb": np.zeros(5),
        "online_ebm": np.array([0, 9, 0, 9, 0]),
        "online_cb": np.array([0, 0, 9, 9, 0]),
    }
    policy = {
        "online_ebm": 8,
        "online_cb": 8,
        "consensus_ebm": 8,
        "consensus_cb": 8,
        "seed_threshold": 10,
        "burst": {"hours": 1, "margin": 4, "threshold": None},
    }
    result = apply(frame, [True, False, False, False, False], scores, policy)
    assert result["online_union"].tolist() == [True, True, True, False, False]
    assert result["online_consensus"].tolist() == [True, False, False, False, False]
    assert all(values[0] for values in result.values())
    policy["online_ebm"] = None
    assert apply(frame, [False] * 5, scores, policy)["online_union"].tolist() == [
        False,
        False,
        True,
        False,
        False,
    ]


@pytest.mark.parametrize("bad", [[1], [1, float("inf")]])
def test_rescue_rejects_misaligned_or_nonfinite_scores(bad: list[float]) -> None:
    frame = pd.DataFrame({"account": ["a", "a"], "seconds": [0, 1]})
    with pytest.raises(ValueError):
        nearby(frame, [True, False], bad, 10, 1, 4)
