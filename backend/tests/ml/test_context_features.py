import math
from dataclasses import replace

import pytest

pytest.importorskip("sortedcontainers")

from app.domain.features.purchase import DAY, Observation
from ml.features.context import MERCHANT_FEATURES, SEQUENCE_FEATURES, context_rows


def event(
    identity: str,
    time: float,
    account: str = "a",
    merchant: str = "m",
    completed: bool = True,
    amount: int = 100,
    available: float | None = None,
    channel: str = "chip",
) -> Observation:
    return Observation(
        identity,
        account,
        time,
        time if available is None else available,
        amount,
        merchant,
        "MCC 1",
        channel,
        completed,
    )


def same(left: dict[str, float], right: dict[str, float]) -> None:
    for name in left:
        if math.isnan(left[name]):
            assert math.isnan(right[name])
        else:
            assert left[name] == pytest.approx(right[name])


def test_merchant_context_uses_other_accounts_without_changing_personal_sequence() -> None:
    target = event("target", 3600, amount=1000, channel="online")
    history = [event("a1", 0), event("a2", 3400, merchant="other", completed=False)]
    plain = dict(context_rows(history + [target]))["target"]
    shared = dict(
        context_rows([history[0], event("b1", 100, account="b", amount=900), history[1], target])
    )["target"]
    for name in SEQUENCE_FEATURES:
        same({name: plain[name]}, {name: shared[name]})
    assert shared["merchant_distinct_accounts_1h"] == 2
    assert shared["merchant_attempts_1h"] == 2
    assert shared["attempts_5m"] == 1
    assert shared["same_merchant_attempts_5m"] == 0
    assert shared["prior_failure_fraction_1h"] == 0.5
    assert shared["last_channel_changed"] == 1
    mean = (math.log1p(100) + math.log1p(900)) / 2
    std = abs(math.log1p(900) - math.log1p(100)) / 2
    assert shared["merchant_log_amount_z_7d"] == pytest.approx((math.log1p(1000) - mean) / std)
    assert any(plain[n] != shared[n] for n in MERCHANT_FEATURES)


def test_context_excludes_same_time_future_current_status_and_unavailable_history() -> None:
    target = event("target", 100)
    initial = [event("prior", 0), target]
    expected = dict(context_rows(initial))["target"]
    altered = [
        initial[0],
        event("late", 50, available=200),
        replace(target, completed=False),
        event("peer", 100, account="b"),
        event("future", 101),
    ]
    same(expected, dict(context_rows(altered))["target"])
    visible = [initial[0], event("late", 50), target]
    assert dict(context_rows(visible))["target"]["attempts_5m"] == expected["attempts_5m"] + 1


def test_late_arrival_expiry_and_ambiguous_predecessors() -> None:
    rows = [
        event("late", 0, available=7 * DAY + 1),
        event("a", 1, merchant="m", amount=100),
        event("b", 1, merchant="other", amount=500, channel="online"),
        event("target", 2),
    ]
    value = dict(context_rows(rows))["target"]
    assert math.isnan(value["last_merchant_changed"])
    assert math.isnan(value["last_channel_changed"])
    assert math.isnan(value["log_amount_over_previous_completed"])
    boundary = event("boundary", 7 * DAY)
    expired = event("expired", 7 * DAY + 2)
    result = dict(context_rows([event("prior", 0), boundary, expired]))
    assert result["boundary"]["merchant_attempts_7d"] == 1
    assert result["expired"]["merchant_attempts_7d"] == 1
    late_result = dict(context_rows([rows[0], expired]))["expired"]
    assert late_result["merchant_attempts_7d"] == 0
    with pytest.raises(ValueError, match="chronological"):
        list(context_rows([expired, boundary]))
