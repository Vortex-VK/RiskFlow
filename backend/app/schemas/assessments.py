from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.schemas.behavioral import BehavioralEvidence
from app.schemas.history import HistoryModel
from app.schemas.lifecycle import LifecycleReport
from app.schemas.profiles import ProfileReport
from app.schemas.scenario import Identifier, RuleId, ScenarioDocument, Timestamp
from app.schemas.simulation import CardPatternReview, CardPatternScores, ModelEvaluation, RunResult


class AssessmentRequest(HistoryModel):
    revision: Annotated[int, Field(ge=0)]
    mode: Literal["retrospective", "as_known"] = "retrospective"
    knowledge_cutoff: Timestamp | None = None
    analysis_mode: Literal["model", "v13", "behavioral"] = "model"

    @model_validator(mode="after")
    def check_cutoff(self) -> "AssessmentRequest":
        if (self.mode == "as_known") != (self.knowledge_cutoff is not None):
            raise ValueError(
                "As-known snapshots require a knowledge cutoff; retrospective runs do not."
            )
        return self


class SignalAvailability(HistoryModel):
    rule_id: RuleId
    available: bool
    reason: str | None


class Assessment(HistoryModel):
    event_id: Identifier
    source_event_id: str
    score: Annotated[int, Field(ge=0, le=100)] | None
    coverage: Literal["complete", "partial", "not_assessed"]
    evaluated_rules: Annotated[int, Field(ge=0, le=6)]
    total_rules: Literal[0, 6] = 6
    model: ModelEvaluation | None = None
    card_pattern: CardPatternReview | None = None
    card_scores: CardPatternScores | None = None
    behavioral: BehavioralEvidence | None = None
    recommendation: Literal["no_alert", "review", "high_priority", "not_assessed"]
    reason: str | None
    signals: list[SignalAvailability]


class AssessmentRun(HistoryModel):
    schema_version: Literal[2] = 2
    id: Identifier
    dataset_id: Identifier
    revision: int
    recorded_at: Timestamp
    mode: Literal["retrospective", "as_known"] = "retrospective"
    analysis_mode: Literal["model", "v13", "behavioral"] = "v13"
    knowledge_cutoff: Timestamp | None = None
    lifecycle: LifecycleReport | None = None
    profiles: ProfileReport | None = None
    knowledge_limitation: str
    input_hash: str
    analysis_hash: str
    adapter_version: Literal["retained-v1", "retained-v2"] = "retained-v1"
    taxonomy_version: Literal["categories-v1"] = "categories-v1"
    assessment_version: Literal[
        "assessment-v2.1",
        "assessment-v2.2",
        "assessment-v2.3",
        "assessment-v2.4",
        "assessment-v2.5",
        "assessment-v2.6",
        "assessment-v2.7",
        "assessment-v2.8",
        "assessment-v2.9",
        "assessment-behavioral-v1",
    ] = "assessment-v2.1"
    document: ScenarioDocument
    simulation: RunResult | None
    assessments: list[Assessment]


class RunSummary(HistoryModel):
    id: Identifier
    revision: int
    recorded_at: Timestamp
    event_count: int
    analysis_hash: str
