from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.schemas.history import HistoryModel
from app.schemas.scenario import Identifier, Timestamp
from app.schemas.simulation import RuleEvaluation


class ProfileConfig(HistoryModel):
    version: Literal["profiles-v1", "profiles-v2"] = "profiles-v1"
    purchase_window_days: Annotated[int, Field(ge=1, le=365)] = 90
    purchase_min_samples: Annotated[int, Field(ge=2, le=100)] = 10
    purchase_min_span_days: Annotated[int, Field(ge=1, le=90)] = 7
    purchase_freshness_days: Annotated[int, Field(ge=1, le=180)] = 30
    bill_window_days: Annotated[int, Field(ge=1, le=365)] = 180
    bill_min_samples: Annotated[int, Field(ge=2, le=100)] = 3
    bill_min_span_days: Annotated[int, Field(ge=1, le=90)] = 28
    bill_freshness_days: Annotated[int, Field(ge=1, le=180)] = 62
    device_min_uses: Annotated[int, Field(ge=2, le=100)] = 3
    device_min_span_days: Annotated[int, Field(ge=1, le=90)] = 7

    @model_validator(mode="after")
    def check_windows(self) -> "ProfileConfig":
        if (
            self.purchase_min_span_days > self.purchase_window_days
            or self.bill_min_span_days > self.bill_window_days
        ):
            raise ValueError("Minimum history span must fit within the profile window.")
        return self


class MerchantAmountRange(HistoryModel):
    merchant_id: str
    category: str
    sample_count: Annotated[int, Field(ge=3, le=20000)]
    distinct_days: Annotated[int, Field(ge=3, le=365)]
    first_observed_at: Timestamp
    last_observed_at: Timestamp
    maximum_minor: Annotated[int, Field(ge=1, le=3_000_000_000_000)]
    evidence_ids: list[Identifier] = Field(min_length=1, max_length=50)
    evidence_count: Annotated[int, Field(ge=3, le=20000)]
    evidence_hash: str


class ProfileSignal(HistoryModel):
    evaluation: RuleEvaluation
    source: Literal["historical", "configured", "observation", "unavailable"]
    population: str
    sample_count: Annotated[int, Field(ge=0, le=20000)]
    minimum_samples: Annotated[int, Field(ge=1)]
    minimum_span_days: Annotated[int, Field(ge=0)]
    window_start: Timestamp
    evaluated_at: Timestamp
    first_observed_at: Timestamp | None
    last_observed_at: Timestamp | None
    evidence_ids: list[Identifier] = Field(max_length=50)
    evidence_count: Annotated[int, Field(ge=0, le=20000)]
    evidence_hash: str
    median_minor: Annotated[int, Field(ge=1)] | None = None
    median_absolute_deviation_minor: Annotated[int, Field(ge=0)] | None = None
    baseline_values: list[str] = Field(default_factory=list)
    trust_state: Literal["unknown", "trusted", "revoked"] = "unknown"
    trust_effective_at: Timestamp | None = None
    trust_provenance: str | None = None
    trust_event_id: Identifier | None = None
    merchant_range: MerchantAmountRange | None = None


class EventProfile(HistoryModel):
    event_id: Identifier
    account_id: str
    currency: str
    signals: list[ProfileSignal] = Field(min_length=4, max_length=4)


class ProfileReport(HistoryModel):
    config: ProfileConfig
    events: list[EventProfile]
