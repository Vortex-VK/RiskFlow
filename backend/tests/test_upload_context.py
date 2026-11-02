import numpy as np
import pandas as pd

from ml.features.upload_context import NUMERIC, transitions


def context_frame():
    return pd.DataFrame(
        {
            "upload": ["a"] * 6,
            "account": ["one"] * 6,
            "seconds": [0.0, 60.0, 60.0, 120.0, 180.0, 86521.0],
            "channel": ["Chip Transaction"] * 4 + ["Online Transaction", "Chip Transaction"],
            "merchant_state": ["CA", "NY", "CA", "NY", "__MISSING__", "TX"],
            "merchant_city": ["A", "B", "A", "B", "ONLINE", "C"],
            "current_completed": [1.0] * 6,
        }
    )


def test_location_history_is_causal_and_equal_time_batches_are_isolated():
    frame = context_frame()
    actual = transitions(frame)
    assert np.isnan(actual.minutes_since_previous.iloc[0])
    assert actual.minutes_since_previous.iloc[1:4].tolist() == [1.0, 1.0, 1.0]
    assert actual.previous_city_changed.iloc[1:4].tolist() == [1.0, 0.0, 0.0]
    assert actual.location_seen_before.iloc[1:4].tolist() == [0.0, 1.0, 1.0]
    assert actual.location_attempts_1h.iloc[3] == 1
    assert actual.distinct_locations_24h.iloc[-1] == 0
    assert np.isnan(actual.location_seen_before.iloc[4])
    assert actual.minutes_since_previous_location.iloc[-1] == (86521 - 120) / 60
    prefix = transitions(frame.iloc[:4])
    pd.testing.assert_frame_equal(prefix, actual.iloc[:4])
    swapped = transitions(frame.iloc[[0, 2, 1, 3, 4, 5]].reset_index(drop=True))
    np.testing.assert_array_equal(swapped[NUMERIC].iloc[[0, 2, 1, 3, 4, 5]], actual[NUMERIC])


def test_location_histories_reset_per_upload_and_account():
    first = context_frame().iloc[:4].copy()
    second = first.copy()
    second["upload"] = "b"
    second["merchant_state"] = "TX"
    combined = pd.concat([first, second], ignore_index=True)
    actual = transitions(combined)
    pd.testing.assert_frame_equal(actual.iloc[:4], transitions(first))
    assert np.isnan(actual.minutes_since_previous.iloc[4])
    second["upload"], second["account"] = "a", "other"
    actual = transitions(pd.concat([first, second], ignore_index=True))
    assert np.isnan(actual.minutes_since_previous.iloc[4])


def test_location_counts_preserve_simultaneous_attempts():
    frame = context_frame().iloc[:4].copy()
    frame["merchant_state"], frame["merchant_city"] = "CA", "A"
    result = transitions(frame)
    assert result.location_attempts_1h.tolist()[1:] == [1.0, 1.0, 3.0]
