import math
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from app.domain.analysis_routing import ROUTING_VERSION, behavioral_inputs
from app.domain.features.behavioral import VERSION, behavioral_rows
from app.domain.identity import canonical_hash, event_hash
from app.domain.lifecycle import reconcile_lifecycle
from app.domain.projections import project_history
from app.schemas.assessments import Assessment, AssessmentRun
from app.schemas.behavioral import BehavioralEvidence
from app.schemas.history import Dataset, FinancialEvent


def assess_behavioral(
    dataset: Dataset,
    events: list[FinancialEvent],
    mode: Literal["retrospective", "as_known"],
    knowledge_cutoff: str | None,
) -> AssessmentRun:
    observations, excluded = behavioral_inputs(events)
    features = {row.id: row for row in behavioral_rows(observations)}
    assessments = []
    for event in sorted(events, key=lambda row: (row.occurred_at, row.id)):
        result = features.get(event.id)
        evidence = None
        reason = excluded.get(event.id)
        if result:
            ratio = result.values["amount_ratio"]
            evidence = BehavioralEvidence(
                occurred_at=event.occurred_at,
                observed_amount=str(Decimal(event.amount_minor) / 100),
                history_count=result.evidence["history_count"],
                median_amount=result.evidence["median_amount"],
                amount_ratio=ratio if math.isfinite(ratio) else None,
                prior_24h_count=int(result.values["count_24h"]),
                currency="USD",
                time_precision=event.time_precision,
                evidence_ids=result.evidence["prior_event_ids"],
                evidence_truncated=result.evidence["evidence_truncated"],
                merchant_identity_available=event.merchant_id is not None,
            )
            reason = "Observed purchase history; no fraud score or payment decision."
        assessments.append(
            Assessment(
                event_id=event.id,
                source_event_id=event.source_event_id,
                score=None,
                coverage="partial" if result else "not_assessed",
                evaluated_rules=0,
                total_rules=0,
                recommendation="not_assessed",
                reason=reason,
                signals=[],
                behavioral=evidence,
            )
        )
    input_hash = canonical_hash(sorted(event_hash(event) for event in events))
    return AssessmentRun(
        id=str(uuid4()),
        dataset_id=dataset.id,
        revision=dataset.revision,
        recorded_at=datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        mode=mode,
        knowledge_cutoff=knowledge_cutoff,
        lifecycle=reconcile_lifecycle(events),
        profiles=None,
        knowledge_limitation="Descriptive observations from strictly prior purchases in this "
        "retained revision. Counts describe observed activity, not settled spending. Equal-time "
        "records do not influence one another; date-only records become history the next day. "
        "No fraud score, probability or payment decision is produced. Evidence lists show up "
        "to eight recent contributing records; statistics use all supported prior observations "
        "within 30 days. Reassessment creates a new saved result.",
        input_hash=input_hash,
        analysis_hash=canonical_hash(
            {
                "input": input_hash,
                "features": VERSION,
                "routing": ROUTING_VERSION,
                "mode": mode,
                "knowledge_cutoff": knowledge_cutoff,
            }
        ),
        adapter_version="retained-v2",
        assessment_version="assessment-behavioral-v1",
        analysis_mode="behavioral",
        document=project_history(dataset, events),
        simulation=None,
        assessments=assessments,
    )
