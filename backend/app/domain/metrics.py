from collections.abc import Mapping

from app.schemas.scenario import CostAssumptions
from app.schemas.simulation import (
    Costs,
    CountAmount,
    Decision,
    EventResult,
    Metrics,
    Rate,
    RuleId,
    TruthMetrics,
)

DECISIONS: tuple[Decision, ...] = ("approve", "review", "block")
RULE_IDS: tuple[RuleId, ...] = (
    "unusual_amount",
    "payment_velocity",
    "new_device",
    "unusual_location",
    "merchant_category_deviation",
    "shared_device_accounts",
)


def ratio(numerator: int, denominator: int) -> Rate | None:
    return Rate(numerator=numerator, denominator=denominator) if denominator else None


def total(events: list[EventResult]) -> CountAmount:
    return CountAmount(count=len(events), amount_minor=sum(e.amount_minor for e in events))


def evaluate_metrics(
    events: list[EventResult], labels: Mapping[str, str], assumptions: CostAssumptions
) -> Metrics:
    decisions = {
        decision: total([e for e in events if e.decision == decision]) for decision in DECISIONS
    }
    labeled = [e for e in events if e.event_id in labels]
    fraud = [e for e in labeled if labels[e.event_id] == "fraudulent"]
    legitimate = [e for e in labeled if labels[e.event_id] == "legitimate"]
    blocked_fraud = total([e for e in fraud if e.decision == "block"])
    approved_fraud = total([e for e in fraud if e.decision == "approve"])
    pending_fraud = total([e for e in fraud if e.decision == "review"])
    blocked_legitimate = total([e for e in legitimate if e.decision == "block"])
    truth = (
        TruthMetrics(
            fraudulent=total(fraud),
            legitimate=total(legitimate),
            blocked_fraud=blocked_fraud,
            approved_fraud=approved_fraud,
            pending_fraud=pending_fraud,
            blocked_legitimate=blocked_legitimate,
            legitimate_block_rate=ratio(blocked_legitimate.count, len(legitimate)),
            fraud_block_rate=ratio(blocked_fraud.count, len(fraud)),
            fraud_approval_rate=ratio(approved_fraud.count, len(fraud)),
        )
        if labeled
        else None
    )
    loss = (approved_fraud.amount_minor * assumptions.approved_fraud_loss_bps + 5000) // 10000
    labeled_review = sum(e.decision == "review" for e in labeled) * assumptions.review_cost_minor
    friction = blocked_legitimate.count * assumptions.false_block_cost_minor
    costs = Costs(
        review_operating_cost_all_minor=decisions["review"].count * assumptions.review_cost_minor,
        estimated_approved_fraud_loss_minor=loss if labeled else None,
        labeled_review_cost_minor=labeled_review if labeled else None,
        estimated_false_block_friction_cost_minor=friction if labeled else None,
        illustrative_labeled_total_cost_minor=loss + labeled_review + friction if labeled else None,
    )
    flagged = decisions["review"].count + decisions["block"].count
    return Metrics(
        total_count=len(events),
        total_amount_minor=sum(e.amount_minor for e in events),
        decisions=decisions,
        decision_rates={d: ratio(decisions[d].count, len(events)) for d in DECISIONS},
        flagged_count=flagged,
        flagged_rate=ratio(flagged, len(events)),
        review_workload=decisions["review"].count,
        score_bins={
            f"{low}-{high}": sum(
                e.risk_score is not None and low <= e.risk_score <= high for e in events
            )
            for low, high in ((0, 19), (20, 39), (40, 59), (60, 79), (80, 100))
        },
        rule_trigger_counts={
            rule: sum(
                any(r.rule_id == rule and r.triggered for r in e.rule_evaluations) for e in events
            )
            for rule in RULE_IDS
        },
        labeled_count=len(labeled),
        unlabeled_count=len(events) - len(labeled),
        truth_metrics=truth,
        costs=costs,
    )
