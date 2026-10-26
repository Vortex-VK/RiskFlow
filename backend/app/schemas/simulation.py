from typing import Annotated, Literal

from pydantic import ConfigDict, Field

from app.limits import MAX_EVIDENCE_EVENTS, MAX_OBJECTS, MAX_PAYMENTS, MAX_TOTAL_MONEY
from app.schemas.scenario import Identifier, ScenarioDefinition, Timestamp, WireModel
from app.schemas.scenario import RuleId as RuleId

Decision = Literal["approve", "review", "block"]
Count = Annotated[int, Field(ge=0, le=MAX_PAYMENTS)]
TotalMoney = Annotated[int, Field(ge=0, le=MAX_TOTAL_MONEY)]


class ResultModel(WireModel):
    model_config = ConfigDict(populate_by_name=True, frozen=True)


class Rate(ResultModel):
    numerator: Annotated[int, Field(ge=0)]
    denominator: Annotated[int, Field(gt=0)]


class CountAmount(ResultModel):
    count: Count
    amount_minor: TotalMoney


class Features(ResultModel):
    amount_minor: Annotated[int, Field(gt=0)]
    typical_amount_minor: Annotated[int, Field(gt=0)] | None
    five_minute_attempt_count: Annotated[int, Field(ge=1, le=MAX_PAYMENTS)] | None
    new_device: bool | None
    unusual_location: bool | None
    category_deviation: bool | None
    shared_device_account_count: Annotated[int, Field(ge=1, le=MAX_OBJECTS)] | None


class Evidence(ResultModel):
    event_count: Annotated[int, Field(ge=0, le=MAX_PAYMENTS)] | None = None
    event_ids: list[Identifier] = Field(default_factory=list, max_length=MAX_EVIDENCE_EVENTS)
    account_ids: list[Identifier] = Field(default_factory=list)
    association_ids: list[Identifier] = Field(default_factory=list)
    device_id: Identifier | None = None
    location_id: Identifier | None = None
    observed_at: Timestamp | None = None
    known_from: Timestamp | None = None
    window_start: Timestamp | None = None
    window_end: Timestamp | None = None


class RuleEvaluation(ResultModel):
    rule_id: RuleId
    available: bool = True
    triggered: bool
    points: Annotated[int, Field(ge=0, le=45)]
    measured: dict[str, int | bool | str | list[str]]
    thresholds: dict[str, int]
    evidence: Evidence
    explanation: str


ScoreSource = Literal[
    "coverage",
    "online_specialist",
    "card_pattern",
    "card_priority",
    "adapted_card",
    "adapted_online",
]


class EvidenceScore(ResultModel):
    version: Literal["margin-index-v1", "fraud-probability-v1", "fraud-probability-v2"] = (
        "margin-index-v1"
    )
    source: ScoreSource
    value: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
    raw_margin: Annotated[float, Field(allow_inf_nan=False)]
    reference_threshold: Annotated[float, Field(allow_inf_nan=False)]
    distance: Annotated[float, Field(allow_inf_nan=False)]
    reference_value: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)] = 50
    probability_available: bool = False
    probability_bundle_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")] | None = None
    calibration_scope: Literal["ibm_synthetic", "ibm_authored_synthetic"] | None = None


class CardPatternScores(ResultModel):
    version: Literal["card-scores-v1"] = "card-scores-v1"
    bundle_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    pattern: EvidenceScore
    priority: EvidenceScore
    history_count: Annotated[int, Field(ge=10, le=MAX_PAYMENTS)]
    review_suggested: bool
    prioritized: bool


class ModelEvaluation(ResultModel):
    version: Literal["ml-v13", "ml-upload-v5", "ml-upload-v7", "ml-upload-v8", "ml-upload-v9"] = (
        "ml-v13"
    )
    policy: Literal["depth6", "recall85", "balanced", "precision95", "mixed-source"] = "depth6"
    bundle_sha256: str
    alert: bool
    raw_scores: dict[str, float]
    detection_paths: list[str]
    history_count: int
    feedback_available: Literal[False] = False
    evidence_scope: Literal["synthetic_benchmark"] = "synthetic_benchmark"
    upload_domain_validated: Literal[False] = False
    probability_available: bool = False
    score: EvidenceScore | None = None


class CardPatternPriority(ResultModel):
    version: Literal["card-pattern-v2"] = "card-pattern-v2"
    level: Literal["prioritized", "exploratory"]
    margin: Annotated[float, Field(allow_inf_nan=False)]
    threshold: Annotated[float, Field(allow_inf_nan=False)]


class CardPatternReview(ResultModel):
    version: Literal["card-pattern-v1", "card-pattern-v5"] = "card-pattern-v1"
    scope: Literal["review_only"] = "review_only"
    bundle_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    margin: Annotated[float, Field(allow_inf_nan=False)]
    threshold: Annotated[float, Field(allow_inf_nan=False)]
    history_count: Annotated[int, Field(ge=10, le=MAX_PAYMENTS)]
    prior_hour_attempts: Annotated[int, Field(ge=0, le=MAX_PAYMENTS)]
    amount_percentile: Annotated[float, Field(ge=0, le=1)] | None
    observations: Annotated[list[str], Field(min_length=2, max_length=4)]
    model_decision_changed: Literal[False] = False
    probability_available: Literal[False] = False
    priority: CardPatternPriority | None = None


class EventResult(ResultModel):
    event_id: Identifier
    sequence_index: Annotated[int, Field(ge=0, lt=MAX_PAYMENTS)]
    occurred_at: Timestamp
    amount_minor: Annotated[int, Field(gt=0, le=100_000_000)]
    account_id: Identifier
    merchant_id: Identifier
    device_id: Identifier
    location_id: Identifier
    features: Features
    rule_evaluations: Annotated[list[RuleEvaluation], Field(max_length=6)]
    raw_score: Annotated[int, Field(ge=0, le=155)] | None
    risk_score: Annotated[int, Field(ge=0, le=100)] | None
    model: ModelEvaluation | None = None
    card_pattern: CardPatternReview | None = None
    card_scores: CardPatternScores | None = None
    decision: Decision


class TruthMetrics(ResultModel):
    fraudulent: CountAmount
    legitimate: CountAmount
    blocked_fraud: CountAmount
    approved_fraud: CountAmount
    pending_fraud: CountAmount
    blocked_legitimate: CountAmount
    legitimate_block_rate: Rate | None
    fraud_block_rate: Rate | None
    fraud_approval_rate: Rate | None


class Costs(ResultModel):
    review_operating_cost_all_minor: TotalMoney
    estimated_approved_fraud_loss_minor: TotalMoney | None
    labeled_review_cost_minor: TotalMoney | None
    estimated_false_block_friction_cost_minor: TotalMoney | None
    illustrative_labeled_total_cost_minor: TotalMoney | None


class Metrics(ResultModel):
    total_count: Count
    total_amount_minor: TotalMoney
    decisions: dict[Decision, CountAmount]
    decision_rates: dict[Decision, Rate | None]
    flagged_count: Count
    flagged_rate: Rate | None
    review_workload: Count
    score_bins: dict[str, Count]
    rule_trigger_counts: dict[RuleId, Count]
    labeled_count: Count
    unlabeled_count: Count
    truth_metrics: TruthMetrics | None
    costs: Costs


class ModelingWarning(ResultModel):
    code: str
    message: str


class SimulationResult(ResultModel):
    engine_version: Literal[
        "engine-v1",
        "engine-v2",
        "engine-v3",
        "engine-ml-v13",
        "engine-ml-upload-v5",
        "engine-ml-upload-v7",
        "engine-ml-upload-v8",
        "engine-ml-upload-v9",
    ] = "engine-ml-upload-v9"
    rule_set_version: Literal[
        "rules-v1",
        "v13-depth6",
        "upload-v5-recall85",
        "upload-v7-balanced",
        "upload-v8-precision95",
        "upload-v9-mixed-source",
    ] = "upload-v9-mixed-source"
    schema_version: Literal[1] = 1
    scenario_snapshot: ScenarioDefinition
    events: list[EventResult]
    metrics: Metrics
    warnings: list[ModelingWarning]


class RunResult(SimulationResult):
    run_id: Identifier
    completed_at: Timestamp
