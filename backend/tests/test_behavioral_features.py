import math
from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.features.behavioral import (
    DAY,
    BehavioralObservation,
    BehavioralState,
    behavioral_rows,
)


def observation(identifier, time, amount="10", **kwargs):
    return BehavioralObservation(
        identifier,
        "source",
        "account",
        "USD",
        time,
        Decimal(amount),
        **kwargs,
    )


def values(rows):
    return {row.id: row.values for row in behavioral_rows(rows)}


def test_independently_calculated_prior_history_and_evidence():
    rows = [
        observation(str(i), i * 100, str(amount), merchant="m")
        for i, amount in enumerate((10, 20, 30, 40, 100))
    ]
    result = list(behavioral_rows(rows))[-1]
    assert result.values["history_count"] == 4
    assert result.values["log_mean_30d"] == pytest.approx(math.log1p(25))
    assert result.values["log_median_30d"] == pytest.approx(math.log1p(20))
    assert result.values["amount_ratio"] == 5
    assert result.values["amount_percentile"] == 1
    assert result.values["robust_deviation"] == 4
    assert result.values["count_1h"] == 4
    assert result.values["merchant_frequency"] == 1
    assert result.values["merchant_accounts_7d"] == 1
    assert result.evidence["prior_event_ids"] == ["0", "1", "2", "3"]
    assert result.evidence["median_amount"] == "20"


def test_ties_and_future_perturbation_do_not_change_earlier_features():
    a, b, c = observation("a", 1), observation("b", 1, "40"), observation("c", 2, "100")
    first = values([a, b, c])
    second = values([b, a, replace(c, amount=Decimal(900))])
    assert first["a"]["history_count"] == second["a"]["history_count"] == 0
    assert first["b"]["history_count"] == second["b"]["history_count"] == 0
    assert first["c"]["history_count"] == 2
    assert first["c"]["log_mean_30d"] == second["c"]["log_mean_30d"]
    assert first["c"]["amount_ratio"] != second["c"]["amount_ratio"]


def test_complete_batches_have_identical_features_across_stream_boundaries():
    rows = [observation("a", 0), observation("b", 1), observation("c", 1), observation("d", 2)]
    state = BehavioralState()
    streamed = list(behavioral_rows(rows[:1], state)) + list(behavioral_rows(rows[1:], state))
    assert [r.values["history_count"] for r in streamed] == [0, 1, 1, 3]
    assert [r.evidence for r in streamed] == [r.evidence for r in behavioral_rows(rows)]
    with pytest.raises(ValueError, match="equal-time"):
        state.batch([observation("late", 1)])


def test_date_only_availability_and_permutation():
    a = observation("a", 0, time_kind="date")
    b = observation("b", 0, "30", time_kind="date")
    c = observation("c", DAY, "100", time_kind="date")
    before = values([a, b, c])
    after = values([b, a, c])
    assert before["a"]["history_count"] == 0
    assert before["c"]["history_count"] == after["c"]["history_count"] == 2
    assert before["c"]["count_24h"] == 2
    assert math.isnan(before["c"]["count_1h"])
    assert math.isnan(before["c"]["history_age_days"])
    assert values([a, observation("instant", DAY - 1)])["instant"]["history_count"] == 0


@pytest.mark.parametrize(
    "field,value", [("source", "other"), ("account", "other"), ("unit", "JPY")]
)
def test_history_scope_isolation(field, value):
    first = observation("a", 1, merchant="merchant")
    second = replace(observation("b", 2, merchant="merchant"), **{field: value})
    result = values([first, second])["b"]
    assert result["history_count"] == 0
    assert result["merchant_count_7d"] == (1 if field == "account" else 0)


def test_missing_merchants_are_not_a_shared_object_and_degradation_recomputes_history():
    a = observation("a", 1, merchant="m")
    b = observation("b", 2, merchant="m")
    full = values([a, b])["b"]
    masked = values([replace(a, merchant=None), b])["b"]
    assert full["merchant_visits_30d"] == 1
    assert masked["merchant_visits_30d"] == 0
    assert masked["history_count"] == 1
    missing = values([replace(a, merchant=None), replace(b, merchant=None)])["b"]
    assert math.isnan(missing["merchant_count_7d"])


def test_availability_delays_and_window_expiry():
    rows = [
        observation("a", 0, available_at=DAY),
        observation("b", DAY - 1),
        observation("c", DAY),
        observation("d", 32 * DAY),
    ]
    result = values(rows)
    assert result["b"]["history_count"] == 0
    assert result["c"]["history_count"] == 2
    assert result["d"]["history_count"] == 0


def test_late_available_merchant_history_expires_by_occurrence():
    rows = [
        observation("a", 0, merchant="m", available_at=8 * DAY),
        observation("b", DAY, merchant="m"),
        observation("c", 8 * DAY, merchant="m"),
    ]
    result = values(rows)["c"]
    assert result["history_count"] == 2
    assert result["merchant_count_7d"] == 1


@pytest.mark.parametrize("amount", ["0", "-1", "1e-1000", "NaN", "Infinity", "1000000000001"])
def test_adjustments_invalid_money_and_nonfinite_amounts_are_not_purchases(amount):
    with pytest.raises(ValueError, match="amount"):
        observation("a", 0, amount)


def test_duplicate_ids_and_resource_limit_fail_explicitly():
    state = BehavioralState(max_observations=1)
    state.batch([observation("a", 1)])
    with pytest.raises(ValueError, match="Duplicate"):
        state.batch([observation("a", 2)])
    with pytest.raises(ValueError, match="budget"):
        state.batch([observation("b", 2)])
