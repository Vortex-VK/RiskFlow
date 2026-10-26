from collections import defaultdict

from app.schemas.history import FinancialEvent
from app.schemas.lifecycle import CurrencyPopulation, LifecycleEntry, LifecycleReport

PURCHASES = {"purchase", "payment", "charge", "bill_payment"}
COMPLETED = {"completed", "complete", "posted", "settled", "success", "succeeded", "paid"}
ATTEMPTS = COMPLETED | {"pending", "declined", "failed", "authorized"}
OUTGOING = {"debit", "out", "outgoing"}
INCOMING = {"credit", "in", "incoming"}


def kind_of(event: FinancialEvent) -> str:
    if event.lifecycle_kind != "unspecified":
        return event.lifecycle_kind
    if event.activity_type in {"authorization", "capture", "refund", "reversal", "status_update"}:
        return event.activity_type
    return "purchase" if event.activity_type in PURCHASES else "unsupported"


def reconcile_lifecycle(events: list[FinancialEvent]) -> LifecycleReport:
    ordered = sorted(events, key=lambda event: (event.occurred_at, event.id))
    by_source = {
        (event.source_namespace, event.account_id, event.source_event_id): event for event in events
    }
    groups: dict[tuple[str, str, str], int] = defaultdict(int)
    for event in events:
        if event.underlying_transaction_id and kind_of(event) in {
            "purchase",
            "authorization",
            "capture",
        }:
            groups[(event.source_namespace, event.account_id, event.underlying_transaction_id)] += 1
    entries: dict[str, LifecycleEntry] = {}
    for event in ordered:
        kind = kind_of(event)
        attempt = (
            kind in {"purchase", "authorization"}
            and event.direction in OUTGOING
            and event.status in ATTEMPTS
            and event.amount_minor != 0
        )
        entry = LifecycleEntry(
            event_id=event.id,
            source_event_id=event.source_event_id,
            account_id=event.account_id,
            transaction_id=event.underlying_transaction_id,
            currency=event.currency,
            kind=kind,
            attempt=attempt,
            resolution="standalone",
            reason="An attempt is not settled spending.",
        )
        group = groups.get(
            (event.source_namespace, event.account_id, event.underlying_transaction_id or ""), 0
        )
        ambiguous = kind == "purchase" and group > 1
        if kind == "unsupported":
            entry = entry.model_copy(
                update={
                    "resolution": "excluded",
                    "reason": "Activity is outside purchase lifecycle accounting.",
                }
            )
        elif ambiguous:
            entry = entry.model_copy(
                update={
                    "attempt": False,
                    "resolution": "unresolved",
                    "reason": "Linked records have ambiguous attempt/spending roles; supply kinds.",
                }
            )
        elif kind in {"purchase", "capture"}:
            if event.status in COMPLETED and event.direction in OUTGOING and event.amount_minor:
                entry = entry.model_copy(
                    update={
                        "settled_minor": abs(event.amount_minor),
                        "reason": "Completed outgoing purchase/capture adds settled spending once.",
                    }
                )
            elif not attempt and event.status not in {
                "pending",
                "declined",
                "failed",
                "authorized",
            }:
                entry = entry.model_copy(
                    update={
                        "resolution": "unresolved",
                        "reason": "Settlement status or direction is unsupported.",
                    }
                )
        elif kind == "authorization" and not attempt:
            entry = entry.model_copy(
                update={
                    "resolution": "unresolved",
                    "reason": "Authorization status, direction or amount is unsupported.",
                }
            )
        if kind in {"refund", "reversal", "status_update"}:
            entry = entry.model_copy(
                update={
                    "resolution": "unresolved",
                    "reason": "A specific related source event is required.",
                }
            )
        entries[event.id] = entry

    adjusted: dict[str, int] = defaultdict(int)
    for event in ordered:
        entry = entries[event.id]
        if entry.kind not in {"capture", "refund", "reversal", "status_update"}:
            continue
        target = by_source.get(
            (event.source_namespace, event.account_id, event.related_event_id or "")
        )
        if target is None:
            if entry.kind == "capture" and not event.related_event_id:
                continue
            entries[event.id] = entry.model_copy(
                update={
                    "resolution": "unresolved",
                    "reason": "Related event is absent in this account/source snapshot.",
                }
            )
            continue
        invalid = (
            target.id == event.id
            or target.occurred_at > event.occurred_at
            or target.currency != event.currency
            or (
                event.underlying_transaction_id is not None
                and target.underlying_transaction_id != event.underlying_transaction_id
            )
        )
        if invalid:
            entries[event.id] = entry.model_copy(
                update={
                    "resolution": "unresolved",
                    "reason": "Related event has incompatible time, currency or transaction ID.",
                }
            )
            continue
        target_entry = entries[target.id]
        updates: dict[str, object] = {"related_event_id": target.id}
        if entry.kind == "capture":
            if (
                target_entry.kind == "authorization"
                and target_entry.attempt
                and target.status not in {"declined", "failed"}
            ):
                updates.update(
                    resolution="resolved",
                    reason="Capture linked to an authorization; it is not another attempt.",
                )
            else:
                updates.update(
                    resolution="unresolved",
                    reason="Capture needs a supported successful/pending authorization link.",
                )
        elif entry.kind == "status_update" and target_entry.kind in {
            "purchase",
            "authorization",
            "capture",
        }:
            updates.update(
                resolution="resolved",
                reason="Status only; use capture/refund/reversal events for money movements.",
            )
        elif entry.kind == "status_update":
            updates.update(
                resolution="unresolved",
                reason="Status update target is not a purchase, authorization or capture.",
            )
        elif entry.kind == "reversal" and target_entry.kind == "authorization":
            if event.status in COMPLETED:
                updates.update(
                    resolution="resolved",
                    reason="Authorization release; no settled spending was reversed.",
                )
            else:
                updates.update(
                    resolution="unresolved",
                    reason="Authorization release is not confirmed complete.",
                )
        elif event.status not in COMPLETED or event.direction not in INCOMING:
            updates.update(
                resolution="unresolved",
                reason="Adjustment needs completed status and explicit incoming direction.",
            )
        elif target_entry.settled_minor <= 0 or target_entry.kind not in {"purchase", "capture"}:
            updates.update(
                resolution="unresolved",
                reason="Adjustment target has no recognized settled purchase amount.",
            )
        elif (
            not event.amount_minor
            or abs(event.amount_minor) + adjusted[target.id] > target_entry.settled_minor
        ):
            updates.update(
                resolution="unresolved",
                reason="Adjustment is zero or exceeds the remaining settled amount.",
            )
        else:
            amount = abs(event.amount_minor)
            adjusted[target.id] += amount
            updates.update(
                resolution="resolved",
                reason="Adjustment reconciled against the remaining settled purchase amount.",
            )
            updates["refunded_minor" if entry.kind == "refund" else "reversed_minor"] = amount
        entries[event.id] = entry.model_copy(update=updates)

    populations: list[CurrencyPopulation] = []
    currencies: dict[str, list[LifecycleEntry]] = defaultdict(list)
    for entry in entries.values():
        currencies[entry.currency].append(entry)
    for currency, items in sorted(currencies.items()):
        settled = sum(item.settled_minor for item in items)
        refunds = sum(item.refunded_minor for item in items)
        reversals = sum(item.reversed_minor for item in items)
        populations.append(
            CurrencyPopulation(
                currency=currency,
                attempt_count=sum(item.attempt for item in items),
                settled_minor=settled,
                refunded_minor=refunds,
                reversed_minor=reversals,
                net_outflow_minor=settled - refunds - reversals,
                unresolved_count=sum(item.resolution == "unresolved" for item in items),
                excluded_count=sum(item.resolution == "excluded" for item in items),
            )
        )
    return LifecycleReport(entries=list(entries.values()), currencies=populations)
