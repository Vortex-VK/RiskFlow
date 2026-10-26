from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from app.domain.engine import ENGINE_VERSION, simulate
from app.domain.identity import canonical_hash, event_hash
from app.domain.lifecycle import reconcile_lifecycle
from app.domain.model_inputs import model_eligibility
from app.domain.projections import ADAPTER_VERSION, TAXONOMY_VERSION, project_history
from app.schemas.assessments import Assessment, AssessmentRun
from app.schemas.history import Dataset, FinancialEvent
from app.schemas.simulation import RunResult
from ml.adaptation_runtime import MANIFEST_SHA256
from ml.adaptation_runtime import VERSION as SCORE_VERSION
from ml.card_priority_runtime import MANIFEST_SHA256 as REVIEW_SHA256
from ml.probability_runtime import MANIFEST_SHA256 as PROBABILITY_SHA256


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def assess_history(
    dataset: Dataset,
    events: list[FinancialEvent],
    mode: Literal["retrospective", "as_known"] = "retrospective",
    knowledge_cutoff: str | None = None,
) -> AssessmentRun:
    lifecycle = reconcile_lifecycle(events)
    populations = {entry.event_id: entry for entry in lifecycle.entries}
    document = project_history(dataset, events, model_only=True)
    completed, identifier = utc_now(), str(uuid4())
    simulation = (
        RunResult(
            **simulate(document.scenario).model_dump(by_alias=True),
            run_id=identifier,
            completed_at=completed,
        )
        if document.scenario.payments
        else None
    )
    results = {event.event_id: event for event in simulation.events} if simulation else {}
    assessments = []
    for event in sorted(events, key=lambda event: (event.occurred_at, event.id)):
        result = results.get(event.id)
        assessments.append(
            Assessment(
                event_id=event.id,
                source_event_id=event.source_event_id,
                score=None,
                coverage="partial" if result else "not_assessed",
                evaluated_rules=0,
                total_rules=0,
                signals=[],
                model=result.model if result else None,
                card_pattern=result.card_pattern if result else None,
                card_scores=result.card_scores if result else None,
                recommendation=("review" if result.decision == "review" else "no_alert")
                if result
                else "not_assessed",
                reason="Upload-v9 scored available history; merchant-fraud feedback is missing."
                if result
                else (
                    (populations[event.id].reason if not populations[event.id].attempt else None)
                    or model_eligibility(event)
                ),
            )
        )
    input_hash = canonical_hash(sorted(event_hash(event) for event in events))
    return AssessmentRun(
        id=identifier,
        analysis_mode="model",
        dataset_id=dataset.id,
        revision=dataset.revision,
        recorded_at=completed,
        mode=mode,
        knowledge_cutoff=knowledge_cutoff,
        lifecycle=lifecycle,
        profiles=None,
        adapter_version=ADAPTER_VERSION,
        assessment_version="assessment-v2.9",
        knowledge_limitation=(
            "Upload-v9 retrospective investigation using the retained revision"
            + (" and source-availability cutoff" if mode == "as_known" else "")
            + ". Upload-v9 is a synthetic-data benchmark; matching fields do not establish "
            "validity for this upload's source. This does not reconstruct original authorization "
            "decisions. Only supported "
            "purchase records contribute to model history. Missing confirmed merchant-fraud "
            "feedback is encoded as zero support. Main probabilities are fitted on IBM and "
            "authored "
            "synthetic data; calibration for this source is unverified. Raw margins are not "
            "probabilities; "
            "no alert does not establish safety."
        ),
        input_hash=input_hash,
        analysis_hash=canonical_hash(
            {
                "input": input_hash,
                "engine": ENGINE_VERSION,
                "bundle": MANIFEST_SHA256,
                "card_pattern_bundle": REVIEW_SHA256,
                "score_version": SCORE_VERSION,
                "probability_bundle": PROBABILITY_SHA256,
                "card_pattern_available": simulation is not None
                and not any(w.code == "card_pattern_unavailable" for w in simulation.warnings),
                "adapter": ADAPTER_VERSION,
                "taxonomy": TAXONOMY_VERSION,
                "assessment": "assessment-v2.9",
                "lifecycle": lifecycle.version,
                "mode": mode,
                "knowledge_cutoff": knowledge_cutoff,
            }
        ),
        document=document,
        simulation=simulation,
        assessments=assessments,
    )
