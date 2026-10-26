import math
from dataclasses import replace

import pytest

pytest.importorskip("sortedcontainers")

from app.domain.features.purchase import DAY, Observation, feature_rows


def event(i: int, day: float, amount: int = 100, **changes: object) -> Observation:
    return replace(
        Observation(
            str(i), "test/USD/account", day * DAY, day * DAY, amount, "shop", "MCC 1", "Chip", True
        ),
        **changes,
    )


def test_prior_only_equal_times_and_current_outcomes() -> None:
    history = [event(i, i) for i in range(10)]
    rows = feature_rows(history + [event(10, 10, 200), event(11, 10, 10000)])
    assert rows[-2].values["history_samples"] == rows[-1].values["history_samples"] == 10
    assert rows[-2].values["amount_percentile"] == 1
    assert rows[-2].values["robust_amount_deviation"] == 100
    changed = feature_rows(history + [event(10, 10, 200, completed=False), event(11, 10, 1)])
    assert rows[-2].values == changed[-2].values
    future = feature_rows(history + [event(10, 10, 200), event(99, 11, 999999)])
    assert rows[-2].values == future[-2].values


def test_late_available_observation_and_expiry() -> None:
    rows = feature_rows(
        [event(0, 0, available_at=3 * DAY), event(1, 1), event(2, 3), event(3, 100)]
    )
    assert rows[1].values["history_samples"] == 0
    assert rows[2].values["history_samples"] == 2
    assert rows[3].values["history_samples"] == 0
    assert math.isnan(float(rows[3].values["amount_percentile"]))


def test_attempts_are_not_completed_spend_and_category_fallback() -> None:
    history = [event(i, i, completed=i != 9) for i in range(11)]
    rows = feature_rows(history + [event(12, 11, 200, category="MCC 2")])
    last = rows[-1]
    assert last.values["attempts_7d"] == 7
    assert last.values["history_samples"] == 10
    assert last.values["category_samples"] == 0
    assert last.values["category_frequency"] == 0
    assert last.values["category_fallback"] == 1
    assert last.values["category_amount_percentile"] == last.values["amount_percentile"] == 1
    assert last.values["log_spend_24h"] == pytest.approx(math.log1p(100))


def test_source_account_isolation_and_duplicate_rejection() -> None:
    with pytest.raises(ValueError, match="scoped account"):
        feature_rows([event(0, 0), event(1, 1, account="another/USD/account")])
    with pytest.raises(ValueError, match="Duplicate"):
        feature_rows([event(0, 0), event(0, 1)])
