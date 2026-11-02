import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.features.geography import DAY, GeoEvent, geo_rows, mature_features


def event(identifier: str, day: float, state: str = "CA", account: str = "a") -> GeoEvent:
    return GeoEvent(identifier, account, day * DAY, state, "Town", "90000", "Chip Transaction")


def test_geography_batches_equal_times_and_isolates_accounts() -> None:
    rows = [event("first", 0), event("same", 0), event("other", 1, account="b"), event("next", 1)]
    values = dict(geo_rows(rows))
    assert values["first"][:2] == [1, 0]
    assert values["same"][:2] == [1, 0]
    assert values["other"][:2] == [1, 0]
    assert values["next"] == [1, 2, 1, 1, 1, 1, 1]
    future = dict(geo_rows(rows + [event("future", 2, "NY")]))
    np.testing.assert_equal(future["next"], values["next"])


def test_geography_window_boundaries_and_new_locations() -> None:
    values = dict(geo_rows([event("first", 0), event("boundary", 90, "NY"), event("expired", 91)]))
    assert values["boundary"][1:6] == [1, 0, 0, 0, 1]
    assert np.isnan(values["boundary"][-1])
    assert values["expired"][1:6] == [1, 0, 0, 0, 1]
    assert np.isnan(values["expired"][-1])


def test_online_and_missing_locations_never_create_geographic_evidence() -> None:
    online = GeoEvent("online", "a", 0, "CA", "Town", "90000", "Online Transaction")
    missing = event("missing", 1, "")
    values = dict(geo_rows([online, missing, event("first", 2)]))
    assert values["online"][:2] == [0, 0]
    assert all(np.isnan(v) for v in values["online"][2:5])
    assert values["missing"][:2] == [0, 0]
    assert values["first"][:2] == [1, 0]
    with pytest.raises(ValueError, match="chronological"):
        list(geo_rows([event("later", 2), event("past", 1)]))


def test_feedback_delay_window_and_shrinkage_have_independent_expected_values() -> None:
    history = pd.DataFrame(
        {
            "merchant": ["a", "a", "b", "a", "a"],
            "seconds": np.array([0, 10, 10, 40, 100]) * DAY,
            "label": [1, 0, 1, 1, 1],
        }
    )
    targets = pd.DataFrame({"merchant": ["a", "b", "unseen"], "seconds": [40 * DAY] * 3})
    actual = mature_features(history, targets, 30)
    np.testing.assert_allclose(actual, [[1, 1, 1], [0, 0, 1], [0, 0, 1]])
    later = targets.copy()
    later["seconds"] = 41 * DAY
    actual = mature_features(history, later, 30)
    np.testing.assert_allclose(
        actual, [[2, 1, (1 + 20 * 2 / 3) / 22], [1, 1, (1 + 20 * 2 / 3) / 21], [0, 0, 2 / 3]]
    )
    truncated = history.loc[history["seconds"] < 11 * DAY]
    np.testing.assert_array_equal(actual, mature_features(truncated, later, 30))
    boundary = pd.DataFrame({"merchant": ["a", "a"], "seconds": [120 * DAY, 121 * DAY]})
    result = mature_features(history.iloc[:1], boundary, 30)
    assert result[:, 0].tolist() == [1, 0]
    with pytest.raises(ValueError, match="positive"):
        mature_features(history, targets, 0)


def test_feedback_handles_empty_history_and_nondefault_target_index() -> None:
    history = pd.DataFrame(
        {
            "merchant": pd.Series(dtype=str),
            "seconds": pd.Series(dtype=int),
            "label": pd.Series(dtype=bool),
        }
    )
    target = pd.DataFrame({"merchant": ["x"], "seconds": [100 * DAY]}, index=[99])
    np.testing.assert_array_equal(mature_features(history, target, 30), [[0, 0, 0]])
