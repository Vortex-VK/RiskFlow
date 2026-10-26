from typing import Annotated, Literal

from pydantic import ConfigDict, Field, model_validator

from app.schemas.scenario import Category, CountryCode, Identifier, Name, Timestamp, WireModel


class HistoryModel(WireModel):
    model_config = ConfigDict(populate_by_name=True, frozen=True)


SourceKey = Annotated[str, Field(min_length=1, max_length=200, pattern=r"\S")]


class DatasetCreate(HistoryModel):
    name: Name
    source_namespace: SourceKey


class Dataset(DatasetCreate):
    id: Identifier
    revision: Annotated[int, Field(ge=0)]
    created_at: Timestamp
    event_count: Annotated[int, Field(ge=0)]


class ImportOptions(HistoryModel):
    columns: dict[str, str] = Field(default_factory=dict, max_length=40)
    delimiter: Literal["auto", ",", ";", "\t"] = "auto"
    decimal_separator: Literal[".", ","] = "."
    date_order: Literal["iso", "mdy", "dmy"] = "iso"
    utc_offset_minutes: Annotated[int, Field(ge=-840, le=840)] | None = None
    declared_currency: Literal["USD"] | None = None
    declared_single_account: SourceKey | None = None
    declared_purchases: bool = False
    declared_outgoing: bool = False


class ImportRequest(HistoryModel):
    filename: Annotated[str, Field(min_length=1, max_length=255)]
    content_base64: Annotated[str, Field(max_length=7_000_000)]
    options: ImportOptions = Field(default_factory=ImportOptions)


class FinancialEvent(HistoryModel):
    id: Identifier
    source_event_id: SourceKey
    source_namespace: SourceKey
    account_id: SourceKey
    occurred_at: Timestamp
    time_precision: Literal["instant", "date"]
    source_available_at: Timestamp | None = None
    underlying_transaction_id: SourceKey | None = None
    lifecycle_kind: Literal[
        "unspecified", "authorization", "capture", "refund", "reversal", "status_update"
    ] = "unspecified"
    related_event_id: SourceKey | None = None
    amount_minor: Annotated[int, Field(ge=-100_000_000, le=100_000_000)]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
    direction: str
    activity_type: str
    status: str
    merchant_id: SourceKey | None = None
    merchant_name: Name | None = None
    merchant_country: CountryCode | None = None
    category: Category | None = None
    source_category: Name | None = None
    device_id: SourceKey | None = None
    location_id: SourceKey | None = None
    location_country: CountryCode | None = None
    device_known_from: Timestamp | None = None
    device_trust_state: Literal["unknown", "trusted", "revoked"] = "unknown"
    device_trust_effective_at: Timestamp | None = None
    device_trust_provenance: SourceKey | None = None
    location_known_from: Timestamp | None = None
    typical_amount_minor: Annotated[int, Field(gt=0, le=100_000_000)] | None = None
    usual_countries: list[CountryCode] = Field(default_factory=list, max_length=249)
    usual_categories: list[Category] = Field(default_factory=list, max_length=8)
    context: dict[str, str] = Field(default_factory=dict)
    source_fields: dict[str, str]

    @model_validator(mode="after")
    def check_device_trust(self) -> "FinancialEvent":
        assertion = self.device_trust_state != "unknown"
        if assertion != bool(self.device_trust_effective_at and self.device_trust_provenance):
            raise ValueError("Device trust requires a state, effective timestamp and provenance.")
        if assertion and not self.device_id:
            raise ValueError("Device trust requires a device identifier.")
        if not assertion and (self.device_trust_effective_at or self.device_trust_provenance):
            raise ValueError("Unknown trust cannot carry a trust assertion.")
        return self


class FieldChange(HistoryModel):
    field: str
    before: str
    after: str


class ImportRow(HistoryModel):
    row: Annotated[int, Field(ge=2)]
    source_event_id: str | None
    disposition: Literal["added", "duplicate", "conflict", "invalid", "corrected"]
    analytical_status: Literal["eligible", "not_assessed", "invalid"]
    reason: str | None
    event_id: Identifier | None
    changes: list[FieldChange] = Field(default_factory=list)


class ImportPreview(HistoryModel):
    id: Identifier
    dataset_id: Identifier
    expected_revision: Annotated[int, Field(ge=0)]
    source_hash: str
    filename: str
    mapping: dict[str, str]
    rows: list[ImportRow]
    errors: list[str]
    can_commit: bool
    committed_revision: int | None = None


class RetainedEvent(HistoryModel):
    event: FinancialEvent
    accepted_revision: int
    recorded_at: Timestamp
    import_id: Identifier
    source_row: int
    analytical_status: Literal["eligible", "not_assessed"]
    reason: str | None
    correction_reason: str | None = None


class CorrectionRequest(HistoryModel):
    expected_revision: Annotated[int, Field(ge=0)]
    event_ids: list[Identifier] = Field(min_length=1, max_length=20_000)
    reason: Annotated[str, Field(min_length=1, max_length=1000, pattern=r"\S")]


class EventPage(HistoryModel):
    items: list[RetainedEvent]
    total: int
    offset: int
    limit: int
