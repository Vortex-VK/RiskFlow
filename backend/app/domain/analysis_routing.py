from collections import Counter
from datetime import datetime
from decimal import Decimal

from app.domain.features.behavioral import DAY, BehavioralObservation
from app.schemas.history import FinancialEvent

ROUTING_VERSION = "behavioral-routing-v1"


def behavioral_reason(event: FinancialEvent) -> str | None:
    if event.currency != "USD":
        return "The retained amount adapter currently supports USD units only."
    if event.activity_type not in {"purchase", "charge", "authorization"}:
        return "Purchase type must be explicit; bills, transfers and unknown types are unscored."
    if event.lifecycle_kind not in {"unspecified", "authorization"}:
        return "Captures, refunds, reversals and status updates are not new observed purchases."
    if event.amount_minor <= 0 or event.direction not in {"debit", "out", "outgoing"}:
        return "Only positive outgoing observed purchases have behavioral history."
    seconds = datetime.fromisoformat(event.occurred_at).timestamp()
    if event.time_precision == "date" and seconds % DAY:
        return "Date-only analysis requires the retained date clock to be a UTC day boundary."
    if (
        event.source_available_at
        and datetime.fromisoformat(event.source_available_at).timestamp() < seconds
    ):
        return "Source availability precedes this observation."
    return None


def behavioral_inputs(
    events: list[FinancialEvent],
) -> tuple[list[BehavioralObservation], dict[str, str]]:
    groups = Counter(
        (event.source_namespace, event.account_id, event.underlying_transaction_id)
        for event in events
        if event.underlying_transaction_id and event.lifecycle_kind == "unspecified"
    )
    observations = []
    excluded = {}
    for event in events:
        reason = behavioral_reason(event)
        if (
            event.underlying_transaction_id
            and groups[(event.source_namespace, event.account_id, event.underlying_transaction_id)]
            > 1
        ):
            reason = "Linked observations have ambiguous lifecycle roles; supply explicit kinds."
        if reason:
            excluded[event.id] = reason
            continue
        observations.append(
            BehavioralObservation(
                id=event.id,
                source=event.source_namespace,
                account=event.account_id,
                unit=event.currency,
                timestamp=datetime.fromisoformat(event.occurred_at).timestamp(),
                amount=Decimal(event.amount_minor) / 100,
                merchant=event.merchant_id,
                time_kind=event.time_precision,
                available_at=datetime.fromisoformat(event.source_available_at).timestamp()
                if event.source_available_at
                else None,
            )
        )
    return sorted(observations, key=lambda row: (row.timestamp, row.id)), excluded
