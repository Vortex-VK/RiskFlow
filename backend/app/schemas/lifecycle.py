from typing import Annotated, Literal

from pydantic import Field

from app.schemas.history import HistoryModel
from app.schemas.scenario import Identifier


class LifecycleEntry(HistoryModel):
    event_id: Identifier
    source_event_id: str
    account_id: str
    transaction_id: str | None
    currency: str
    kind: str
    attempt: bool
    settled_minor: Annotated[int, Field(ge=0)] = 0
    refunded_minor: Annotated[int, Field(ge=0)] = 0
    reversed_minor: Annotated[int, Field(ge=0)] = 0
    related_event_id: Identifier | None = None
    resolution: Literal["resolved", "standalone", "unresolved", "excluded"]
    reason: str


class CurrencyPopulation(HistoryModel):
    currency: str
    attempt_count: Annotated[int, Field(ge=0)]
    settled_minor: Annotated[int, Field(ge=0)]
    refunded_minor: Annotated[int, Field(ge=0)]
    reversed_minor: Annotated[int, Field(ge=0)]
    net_outflow_minor: Annotated[int, Field(ge=0)]
    unresolved_count: Annotated[int, Field(ge=0)]
    excluded_count: Annotated[int, Field(ge=0)]


class LifecycleReport(HistoryModel):
    version: Literal["lifecycle-v1"] = "lifecycle-v1"
    entries: list[LifecycleEntry]
    currencies: list[CurrencyPopulation]
