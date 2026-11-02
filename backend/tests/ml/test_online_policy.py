import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.policies.online import episode


def test_episode_rejects_future_same_time_other_channel_and_recursive_seeds() -> None:
    frame = pd.DataFrame(
        {
            "account": ["a"] * 6 + ["b"] * 2,
            "seconds": [-1, 0, 0, 3500, 7000, 10, 0, 30],
            "channel": ["Online Transaction"] * 5
            + ["Chip Transaction", "Chip Transaction", "Online Transaction"],
        }
    )
    source = np.array([6, 10, 6, 6, 6, 6, 10, 6])
    policy = {"cutoff": 10, "burst": {"hours": 1, "margin": 4.0, "threshold": 5}}
    expected = np.array([False, True, False, True, False, False, False, False])
    np.testing.assert_array_equal(episode(frame, source, np.full(8, 6), policy), expected)
    np.testing.assert_array_equal(
        episode(frame.iloc[:4], source[:4], np.full(4, 6), policy), expected[:4]
    )
    guard = np.full(8, 6)
    guard[3] = 4
    assert not episode(frame, source, guard, policy)[3]
