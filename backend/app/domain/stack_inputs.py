"""Explicit adapters for uploaded purchases and user-authored scenarios."""

from typing import Any

import pandas as pd

from app.schemas.history import FinancialEvent
from app.schemas.scenario import PaymentEvent

MISSING = {"", "unknown", "none", "null", "nan", "n/a"}


def stack_eligibility(event: FinancialEvent) -> str | None:
    if event.lifecycle_kind in {"capture", "refund", "reversal", "status_update"}:
        return "Lifecycle accounting records are retained without another purchase score."
    if event.currency != "USD":
        return "Stack-d5 supports USD purchases only."
    if event.direction not in {"debit", "out", "outgoing"}:
        return "Incoming or unknown-direction activity is not ranked as a purchase."
    if event.status in {"reversed", "refunded", "cancelled", "canceled"}:
        return "Reversed, refunded or cancelled activity is retained without a purchase score."
    if event.amount_minor == 0:
        return "Zero-value activity is retained without a purchase score."
    if (event.merchant_id or "").strip().lower() in MISSING:
        return "A stable merchant ID is required for purchase ranking."
    if event.account_id.strip().lower() in MISSING:
        return "A stable account ID is required for purchase ranking."
    if event.activity_type not in {"purchase", "charge", "authorization"}:
        return "Stack-d5 supports purchases, charges and authorizations only."
    if abs(event.amount_minor) > 100_000_000:
        return "Amount exceeds the supported purchase range."
    return None


def history_frame(events: list[FinancialEvent]) -> Any:
    rows = []
    for event in events:
        fields = {
            key.strip().lower().replace(" ", "_"): value
            for key, value in {**event.source_fields, **event.context}.items()
        }
        rows.append(
            {
                # Source IDs preserve the frozen queue's tie ordering within a source.
                "payment_id": event.source_namespace + ":" + event.source_event_id,
                "namespace": event.source_namespace,
                "account_id": event.account_id,
                "merchant_id": event.merchant_id,
                "amount": abs(event.amount_minor) / 100,
                "currency": event.currency,
                "activity_type": event.activity_type,
                "timestamp": event.occurred_at[:10]
                if event.time_precision == "date"
                else event.occurred_at,
                "precision": "day" if event.time_precision == "date" else "second",
                "category": fields.get("mcc") or event.source_category or "",
                "channel": fields.get("channel") or fields.get("use_chip", ""),
                "status": event.status,
                "merchant_region": fields.get("merchant_region")
                or fields.get("merchant_state", ""),
                "merchant_city": fields.get("merchant_city", ""),
            }
        )
    return pd.DataFrame(rows)


def scenario_frame(payments: list[PaymentEvent]) -> Any:
    rows = []
    for payment in payments:
        supplied = payment.model_input
        ranking = payment.ranking_input
        if ranking and not ranking.merchant_id_provided:
            # Graph placeholders must not masquerade as stable source identities.
            from app.domain.model_inputs import UnsupportedModelInput

            raise UnsupportedModelInput("A stable merchant ID is required for purchase ranking.")
        if ranking and ranking.activity_type not in {"purchase", "charge", "authorization"}:
            from app.domain.model_inputs import UnsupportedModelInput

            raise UnsupportedModelInput(
                "Stack-d5 ranks purchases, charges and authorizations only."
            )
        rows.append(
            {
                "payment_id": payment.id,
                "namespace": "scenario",
                "account_id": payment.account_id,
                "merchant_id": payment.merchant_id,
                "amount": payment.amount_minor / 100,
                "currency": "USD",
                "activity_type": "purchase",
                "timestamp": payment.occurred_at,
                "precision": "day" if "payment_velocity" in payment.unavailable_rules else "second",
                "category": supplied.mcc if supplied else payment.source_category or "",
                "channel": supplied.channel if supplied else "",
                "completed": float(supplied.completed) if supplied else float("nan"),
                "merchant_region": supplied.merchant_state if supplied else "",
                "merchant_city": supplied.merchant_city if supplied else "",
            }
        )
        if ranking:
            rows[-1].update(
                {
                    "payment_id": ranking.source_payment_id,
                    "activity_type": ranking.activity_type,
                    "precision": ranking.time_precision,
                    "category": ranking.category,
                    "channel": ranking.channel,
                    "completed": float(ranking.completed)
                    if ranking.completed is not None
                    else float("nan"),
                    "merchant_region": ranking.merchant_region,
                    "merchant_city": ranking.merchant_city,
                }
            )
    # Date-only scenarios carry a midnight placeholder; expose its actual precision.
    for row in rows:
        if row["precision"] == "day":
            row["timestamp"] = str(row["timestamp"])[:10]
    return pd.DataFrame(rows)
