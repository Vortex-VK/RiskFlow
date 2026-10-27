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
