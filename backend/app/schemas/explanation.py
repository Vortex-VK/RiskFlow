from typing import Annotated, Literal

from pydantic import Field

from app.schemas.scenario import Identifier, ScenarioDefinition, WireModel
from app.schemas.simulation import ResultModel

Finite = Annotated[float, Field(allow_inf_nan=False)]


class ExplanationRequest(WireModel):
    scenario: ScenarioDefinition
    event_id: Identifier
    model_bundle_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    expected_raw_margin: Finite


class FeatureContribution(ResultModel):
    feature: str
    value: str | Finite | None
    contribution: Finite


class PaymentExplanation(ResultModel):
    event_id: Identifier
    model_bundle_sha256: str
    method: Literal["tree-shap-final-head-v1"] = "tree-shap-final-head-v1"
    base_value: Finite
    raw_margin: Finite
    probability: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
    contributions: list[FeatureContribution]


class RankingFact(ResultModel):
    label: str
    value: str
    comparison: str


class ExpertExplanation(ResultModel):
    expert: str
    base_value: Finite
    raw_margin: Finite
    contributions: list[FeatureContribution]


class StackPaymentExplanation(ResultModel):
    event_id: Identifier
    model_bundle_sha256: str
    method: Literal["tree-shap-stack-head-v1"] = "tree-shap-stack-head-v1"
    base_value: Finite
    raw_margin: Finite
    contributions: list[FeatureContribution]
    facts: list[RankingFact]
    experts: list[ExpertExplanation]


class StackComparisonRequest(ExplanationRequest):
    reference_event_id: Identifier
    expected_reference_raw_margin: Finite


class ComparativeObservation(FeatureContribution):
    reference_value: str | Finite | None


class ComparativeCheck(ResultModel):
    feature: str
    contribution: Finite
    observations: list[ComparativeObservation]


class StackComparisonExplanation(ResultModel):
    event_id: Identifier
    reference_event_id: Identifier
    model_bundle_sha256: str
    method: Literal["grouped-shapley-head-attribution-v1"] = "grouped-shapley-head-attribution-v1"
    checks: list[ComparativeCheck]
