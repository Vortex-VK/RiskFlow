import pytest

pytest.importorskip("interpret")

import numpy as np
import pandas as pd

from ml.policies.rescue import apply


def test_corroboration_rejects_unsafe_rescue_and_preserves_every_original_alert() -> None:
    frame = pd.DataFrame(
        {"account": ["a"] * 7, "seconds": list(range(7)), "label": [True] * 6 + [False]}
    )
    baseline = np.array([10] + [6] * 6)
    cb = np.array([0] + [9] * 5 + [8])
    base_alerts = baseline >= 10
    cb_alerts = np.zeros(7, dtype=bool)
    policy = {
        "seed_threshold": 10,
        "burst": {"hours": 1, "margin": 4.0, "threshold": 9.0},
        "agreement": None,
    }
    assert policy["burst"] == {"hours": 1, "margin": 4.0, "threshold": 9.0}
    assert policy["agreement"] is None
    output = apply(frame.drop(columns="label"), baseline, cb, cb_alerts, policy)
    assert output["guarded_burst"].tolist() == [True] * 6 + [False]
    assert output["agreement"].tolist() == base_alerts.tolist()
    assert all(np.all(value[base_alerts]) for value in output.values())
    unrelated = pd.concat(
        [frame, pd.DataFrame({"account": ["b"], "seconds": [8], "label": [True]})],
        ignore_index=True,
    )
    future = apply(unrelated, np.r_[baseline, 6], np.r_[cb, 9], np.r_[cb_alerts, False], policy)
    assert not future["guarded_burst"][-1]
    np.testing.assert_array_equal(future["guarded_burst"][:-1], output["guarded_burst"])
