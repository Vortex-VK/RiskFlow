from typing import Annotated, Literal

from pydantic import Field

from app.schemas.history import HistoryModel
from app.schemas.scenario import Identifier, Timestamp


class BehavioralEvidence(HistoryModel):
    version: Literal["behavioral-features-v1"] = "behavioral-features-v1"
    analysis_kind: Literal["descriptive"] = "descriptive"
    occurred_at: Timestamp
    observed_amount: str
    history_count: Annotated[int, Field(ge=0, le=20_000)]
    horizon_days: Literal[30] = 30
    median_amount: str | None
    amount_ratio: Annotated[float, Field(ge=0, allow_inf_nan=False)] | None
    prior_24h_count: Annotated[int, Field(ge=0, le=20_000)]
    currency: Literal["USD"]
    time_precision: Literal["instant", "date"]
    evidence_ids: list[Identifier] = Field(max_length=8)
    evidence_truncated: bool
    merchant_identity_available: bool


class AnalysisCapabilities(HistoryModel):
    version: Literal["analysis-capabilities-v1"] = "analysis-capabilities-v1"
    retained_modes: list[Literal["model", "v13", "behavioral"]]
    behavioral_version: Literal["behavioral-features-v1"] = "behavioral-features-v1"
    behavioral_score_kind: Literal["none"] = "none"
    behavioral_currencies: list[Literal["USD"]]
    recommended_retained_mode: Literal["behavioral"] = "behavioral"
    model_evidence_scope: Literal["synthetic_benchmark"] = "synthetic_benchmark"
    schema_match_validates_domain: Literal[False] = False
    ieee_inference_available: Literal[False] = False
