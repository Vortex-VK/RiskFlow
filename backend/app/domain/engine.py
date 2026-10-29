from typing import Any

import pandas as pd

from app.domain.metrics import evaluate_metrics
from app.domain.stack_inputs import scenario_frame
from app.domain.validation import validate_scenario
from app.schemas.scenario import AccountNode, ScenarioDefinition
from app.schemas.simulation import (
    EventResult,
    Features,
    ModelEvaluation,
    ModelingWarning,
    RankingEvidence,
    SimulationResult,
)
from ml.stack_runtime import MANIFEST_SHA256, runtime

ENGINE_VERSION = "engine-ml-stack-d5"


def simulate(scenario: ScenarioDefinition, canonical: Any = None) -> SimulationResult:
    if validate_scenario(scenario):
        raise ValueError("Scenario must pass validation before simulation.")
    snapshot = scenario.model_copy(deep=True)
    snapshot.nodes.sort(key=lambda node: node.id)
    for node in snapshot.nodes:
        if isinstance(node, AccountNode):
            node.usual_country_codes.sort()
            node.usual_merchant_categories.sort()
    snapshot.associations.sort(key=lambda a: a.id)
    snapshot.payments.sort(key=lambda p: (p.occurred_at, p.id))
    data = scenario_frame(snapshot.payments) if canonical is None else canonical
    frame, scores, selected, history = runtime().predict(data)
    percentiles = pd.Series(scores["stack_d5"]).rank(pct=True).to_numpy() * 100
    optional = ["category", "channel", "completed", "merchant_region", "merchant_city"]
    available = [
        [
            name
            for name in optional
            if pd.notna(row.get(name))
            and str(row.get(name, "")).strip().lower()
            not in {"", "none", "nan", "null", "unknown", "n/a"}
            and not (
                name in {"merchant_region", "merchant_city"}
                and str(row.get(name, "")).strip().upper() == "ONLINE"
            )
        ]
        for _, row in frame.iterrows()
    ]
    events = [
        EventResult(
            event_id=p.id,
            sequence_index=index,
            occurred_at=p.occurred_at,
            amount_minor=p.amount_minor,
            account_id=p.account_id,
            merchant_id=p.merchant_id,
            device_id=p.device_id,
            location_id=p.location_id,
            features=Features(
                amount_minor=p.amount_minor,
                typical_amount_minor=None,
                five_minute_attempt_count=None,
                new_device=None,
                unusual_location=None,
                category_deviation=None,
                shared_device_account_count=None,
            ),
            rule_evaluations=[],
            raw_score=None,
            risk_score=None,
            decision="review" if selected[index] else "approve",
            card_pattern=None,
            card_scores=None,
            model=ModelEvaluation(
                version="ml-stack-d5",
                policy="review-budget",
                bundle_sha256=MANIFEST_SHA256,
                alert=bool(selected[index]),
                raw_scores={name: float(values[index]) for name, values in scores.items()},
                detection_paths=["review_queue"] if selected[index] else [],
                history_count=int(history[index]),
                evidence_scope="exposed_development",
                probability_available=False,
                ranking=RankingEvidence(
                    raw_margin=float(scores["stack_d5"][index]),
                    priority_percentile=float(percentiles[index]),
                    time_precision="day" if frame.calendar_hour.isna().any() else "second",
                    available_fields=available[index],
                    missing_fields=[name for name in optional if name not in available[index]],
                ),
            ),
        )
        for index, p in enumerate(snapshot.payments)
    ]
    return SimulationResult(
        scenario_snapshot=snapshot,
        events=events,
        metrics=evaluate_metrics(events, snapshot.ground_truth, snapshot.cost_assumptions),
        warnings=[
            ModelingWarning(
                code="ranking_scope",
                message="Stack-d5 combines eight frozen expert scores with prior history. "
                "Review priority is a within-upload percentile, not a fraud probability. "
                "Performance on a new source is unverified; development labels were exposed.",
            ),
            ModelingWarning(
                code="review_budget",
                message="Retrospective review selects the highest scores within each UTC day: "
                "ceil(1% of assessed purchases), ties by stable payment ID. Small days can exceed "
                "1% overall. Adding records can change the queue and percentiles. No alert does "
                "not establish safety. Review does not authorize or block a payment.",
            ),
            ModelingWarning(
                code="incomplete_data",
                message="Only supported purchases contribute to history. Missing optional fields "
                "remain unknown. Short histories can reduce performance. Labels and device "
                "identities are excluded from scoring; merchant-fraud feedback is unavailable.",
            ),
            ModelingWarning(
                code="attempt_history",
                message="Features use strictly earlier observations; equal-time peers cannot "
                "affect each other. Date-only rows make all history use whole-day batches "
                "and omit calendar signals. Queues use the entire submitted day retrospectively.",
            ),
        ],
    )
