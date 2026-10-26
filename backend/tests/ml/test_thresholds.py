import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.policies.thresholds import (
    propagate,
)


def test_burst_is_strictly_prior_account_isolated_and_nonrecursive() -> None:
    frame = pd.DataFrame({"account": ["a", "a", "b", "a", "a"], "seconds": [0, 0, 1, 3600, 7199]})
    values = np.array([5, 3, 3, 3, 3])
    expected = [True, False, False, True, False]
    assert propagate(frame, values, 5, 1, 2).tolist() == expected
    future = pd.concat(
        [frame, pd.DataFrame({"account": ["a"], "seconds": [7200]})], ignore_index=True
    )
    assert propagate(future, np.r_[values, 8], 5, 1, 2)[:5].tolist() == expected
    order = [4, 1, 0, 3, 2]
    reordered = propagate(frame.iloc[order], values[order], 5, 1, 2)
    assert reordered.tolist() == [expected[i] for i in order]
    with pytest.raises(ValueError):
        propagate(frame, values, 5, -1, 2)
