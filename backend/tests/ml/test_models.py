import pytest

pytest.importorskip("interpret")

import numpy as np

from ml.models import check_values


def test_numeric_guard_rejects_huge_finite_scores_and_nonfinite_values() -> None:
    assert check_values([-100, 0, 30]) == {"maximum_absolute_score": 100}
    for values in ([1e45, 1e45 + 1e30], [np.nan], [np.inf], []):
        with pytest.raises(ValueError):
            check_values(values)
