import math
from dataclasses import replace

import pytest

pytest.importorskip("sortedcontainers")

from app.domain.features.purchase import DAY, Observation
from app.domain.features.purchase import feature_rows as legacy_features
from ml.features.history import HARD_FEATURES, feature_rows


def event(name: str, day: float, amount: int = 100, category: str = "one") -> Observation:
    return Observation(
        name,
        "IBM/USD/account",
        day * DAY,
        day * DAY,
        amount,
        "merchant",
        category,
        "Chip Transaction",
        True,
    )


def test_decayed_moments_and_soft_category_shrinkage_have_independent_values() -> None:
    history = [event("a", 0, 100, "other"), event("b", 30, 900, "one")]
    row = feature_rows(history + [event("target", 30, 100)])[-1]
    assert row.values["ew_account_support"] == 0.5
    assert row.values["ew_category_support"] == 0
    assert row.values["category_shrink_weight"] == 0
    assert row.values["ew_account_log_mean"] == pytest.approx(math.log1p(100))
    row = feature_rows(history + [event("target", 60, 500)])[-1]
    account_mean = (0.25 * math.log1p(100) + 0.5 * math.log1p(900)) / 0.75
    weight = 0.5 / 8.5
    assert row.values["ew_account_support"] == pytest.approx(0.75)
    assert row.values["category_shrink_weight"] == pytest.approx(weight)
    assert row.values["shrunk_category_log_mean"] == pytest.approx(
        weight * math.log1p(900) + (1 - weight) * account_mean
    )
    assert math.isfinite(float(row.values["shrunk_log_amount_z"]))
    assert math.isnan(float(row.values["category_robust_deviation"]))


def test_adaptive_features_preserve_hard_features_and_do_not_see_future_or_same_time() -> None:
    history = [event(str(i), i, 100 + 10 * i) for i in range(12)]
    target = event("target", 13, 200)
    original = feature_rows(history + [target])[-1]
    old = legacy_features(history + [target])[-1]
    for name in HARD_FEATURES:
        left, right = original.values[name], old.values[name]
        assert left == right or (
            isinstance(left, float)
            and isinstance(right, float)
            and math.isnan(left)
            and math.isnan(right)
        )
    changed = feature_rows(
        history
        + [
            replace(target, completed=False),
            event("same-time", 13, 999999),
            event("future", 14, 999999),
        ]
    )
    assert next(row for row in changed if row.id == "target").values == original.values


def test_late_arrival_expiry_and_failed_attempt_do_not_invent_completed_support() -> None:
    old = replace(event("old", 0), available_at=10 * DAY)
    failed = replace(event("failed", 1, 99999), completed=False)
    rows = feature_rows(
        [old, failed, event("before", 2), event("arrival", 10), event("after", 101)]
    )
    assert rows[2].values["ew_account_support"] == 0
    expected = 2 ** (-10 / 30) + 2 ** (-8 / 30)
    assert rows[3].values["ew_account_support"] == pytest.approx(expected)
    assert rows[-1].values["ew_account_support"] == 0
    assert math.isnan(float(rows[-1].values["shrunk_log_amount_z"]))


def test_account_and_identity_isolation_remain_required() -> None:
    with pytest.raises(ValueError, match="one scoped account"):
        feature_rows([event("a", 0), replace(event("b", 1), account="another")])
    with pytest.raises(ValueError, match="Duplicate"):
        feature_rows([event("a", 0), event("a", 1)])
