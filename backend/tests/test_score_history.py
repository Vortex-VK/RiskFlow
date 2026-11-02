import numpy as np
import pandas as pd
import pytest

from ml.features.score_history import FEATURES, score_history


def history_frame(times, uploads=None, accounts=None):
    return pd.DataFrame(
        {
            "seconds": times,
            "upload": uploads or ["file"] * len(times),
            "account": accounts or ["card"] * len(times),
        }
    )


def test_history_is_strictly_prior_and_equal_time_batches_are_isolated():
    frame = history_frame([0, 0, 60, 120])
    margins = np.array([2.0, -4.0, 100.0, -10.0])
    actual = pd.DataFrame(score_history(frame, margins), columns=FEATURES)
    np.testing.assert_array_equal(actual.prior_margin_count_1h, [0, 0, 2, 3])
    assert actual.prior_margin_mean_1h.iloc[2] == -1
    assert actual.prior_margin_positive_fraction_1h.iloc[2] == 0.5
    assert actual.hours_since_positive_margin.iloc[2] == pytest.approx(1 / 60)
    changed = margins.copy()
    changed[2:] = [-2000, 3000]
    np.testing.assert_array_equal(
        score_history(frame, margins)[:3], score_history(frame, changed)[:3]
    )


def test_history_resets_at_upload_and_account_boundaries():
    frame = history_frame([0, 1, 2, 3], ["a", "a", "b", "a"], ["x", "y", "x", "x"])
    actual = score_history(frame, [4, 8, 16, 32])
    np.testing.assert_array_equal(actual[:, 0], [0, 0, 0, 1])
    assert actual[3, 1] == 4


def test_history_handles_nondefault_index_permutations_and_never_reads_labels():
    frame = history_frame([0, 60, 60, 120])
    frame.index = [20, 40, 60, 80]
    frame["label"] = [True, False, True, False]
    margins = np.array([1, 2, 3, 4])
    expected = score_history(frame, margins)
    permutation = [3, 2, 0, 1]
    shuffled = frame.iloc[permutation].copy()
    shuffled.label = ~shuffled.label
    actual = score_history(shuffled, margins[permutation])
    np.testing.assert_array_equal(actual, expected[permutation])


def test_history_window_expiry_keeps_exact_boundary():
    frame = history_frame([0, 3600, 3601, 604801])
    actual = score_history(frame, [2, -1, -1, -1])
    np.testing.assert_array_equal(actual[:, 0], [0, 1, 1, 0])
    assert actual[2, 1] == -1
    assert actual[3, 8] == 2


@pytest.mark.parametrize("margins", [[1], [1, np.inf], [1, np.nan]])
def test_history_rejects_invalid_margin_inputs(margins):
    with pytest.raises(ValueError, match="aligned finite"):
        score_history(history_frame([0, 1]), margins)
