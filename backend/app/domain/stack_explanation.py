"""Verified head attribution and factual, strictly prior transaction comparisons."""

import math

import numpy as np
from starlette.exceptions import HTTPException

from app.domain.stack_inputs import scenario_frame
from app.schemas.explanation import (
    ComparativeCheck,
    ExpertExplanation,
    ExplanationRequest,
    FeatureContribution,
    RankingFact,
    StackComparisonExplanation,
    StackComparisonRequest,
    StackPaymentExplanation,
)
from ml.stack_comparison import compare_checks
from ml.stack_runtime import MANIFEST_SHA256, runtime


def explain_comparison(payload: StackComparisonRequest) -> StackComparisonExplanation:
    if payload.model_bundle_sha256 != MANIFEST_SHA256:
        raise HTTPException(409, "This saved result uses a different model version.")
    payments = sorted(payload.scenario.payments, key=lambda p: (p.occurred_at, p.id))
    indices = {payment.id: i for i, payment in enumerate(payments)}
    if payload.event_id not in indices or payload.reference_event_id not in indices:
        raise HTTPException(404, "Payment not found in this snapshot.")
    selected, reference, checks = compare_checks(
        scenario_frame(payments), indices[payload.event_id], indices[payload.reference_event_id]
    )
    if not math.isclose(
        selected, payload.expected_raw_margin, abs_tol=1e-7, rel_tol=0
    ) or not math.isclose(
        reference, payload.expected_reference_raw_margin, abs_tol=1e-7, rel_tol=0
    ):
        raise HTTPException(409, "This snapshot does not reproduce the saved scores.")
    return StackComparisonExplanation(
        event_id=payload.event_id,
        reference_event_id=payload.reference_event_id,
        model_bundle_sha256=MANIFEST_SHA256,
        checks=[ComparativeCheck.model_validate(check) for check in checks],
    )


def explain_stack(payload: ExplanationRequest) -> StackPaymentExplanation:
    payments = sorted(payload.scenario.payments, key=lambda p: (p.occurred_at, p.id))
    index = next((i for i, p in enumerate(payments) if p.id == payload.event_id), None)
    if index is None:
        raise HTTPException(404, "Payment not found in this snapshot.")
    # Full snapshot preserves whole-day batching when a later row has date-only precision.
    normalized, row, values, raw, experts = runtime().explain(scenario_frame(payments), index)
    if not math.isclose(raw, payload.expected_raw_margin, rel_tol=1e-7, abs_tol=1e-7):
        raise HTTPException(409, "This snapshot does not reproduce the saved score.")
    current = normalized.iloc[index]
    prior = normalized[
        normalized.namespace.eq(current.namespace)
        & normalized.account_id.eq(current.account_id)
        & normalized.currency.eq(current.currency)
        & normalized.event_time.lt(current.event_time)
    ]
    facts = []
    recent_times = sorted(prior.event_time.unique())[-100:]
    history = prior[prior.event_time.isin(recent_times)]
    baseline = float(np.exp(np.log(history.amount).mean())) if len(history) >= 5 else None
    facts.append(
        RankingFact(
            label="Purchase amount",
            value=f"${current.amount:,.2f}",
            comparison=(
                f"{current.amount / baseline:.1f}× usual ${baseline:,.2f} · "
                f"{len(history)} earlier purchases"
                if baseline is not None
                else f"{len(history)} earlier {'purchase' if len(history) == 1 else 'purchases'}"
                " · 5 needed to compare"
            ),
        )
    )
    seen = int(prior.merchant_id.eq(current.merchant_id).sum())
    facts.append(
        RankingFact(
            label="At this merchant",
            value=f"{seen} earlier {'purchase' if seen == 1 else 'purchases'}",
            comparison=(
                f"Account history: {len(prior)} {'purchase' if len(prior) == 1 else 'purchases'}"
            ),
        )
    )
    if normalized.calendar_hour.notna().all():
        count = int(prior.event_time.ge(current.event_time - 3600).sum())
        facts.append(
            RankingFact(
                label="Previous hour",
                value=f"{count} {'purchase' if count == 1 else 'purchases'}",
                comparison="Earlier purchases only",
            )
        )
    else:
        facts.append(
            RankingFact(
                label="Time detail",
                value="Whole-day history",
                comparison="Hourly activity is unavailable",
            )
        )
    if len(prior) and str(current.channel).strip().lower() not in {"", "nan", "none", "unknown"}:
        count = int(prior.channel.eq(current.channel).sum())
        facts.append(
            RankingFact(
                label="Payment method",
                value=str(current.channel).removesuffix(" Transaction"),
                comparison=f"Used before: {count} of {len(prior)} purchases",
            )
        )
    return StackPaymentExplanation(
        event_id=payload.event_id,
        model_bundle_sha256=MANIFEST_SHA256,
        base_value=float(values[-1]),
        raw_margin=raw,
        contributions=[
            FeatureContribution(
                feature=str(name),
                value=float(row[name]) if np.isfinite(row[name]) else None,
                contribution=float(value),
            )
            for name, value in zip(row.index, values[:-1], strict=True)
        ],
        facts=facts,
        experts=[
            ExpertExplanation(
                expert=name,
                base_value=float(shap[-1]),
                raw_margin=margin,
                contributions=[
                    FeatureContribution(
                        feature=str(feature),
                        value=observed[feature]
                        if isinstance(observed[feature], str)
                        else float(observed[feature])
                        if np.isfinite(observed[feature])
                        else None,
                        contribution=float(contribution),
                    )
                    for feature, contribution in zip(observed.index, shap[:-1], strict=True)
                ],
            )
            for name, observed, shap, margin in experts
        ],
    )
