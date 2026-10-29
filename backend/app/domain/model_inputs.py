import re
from collections import defaultdict
from datetime import datetime
from importlib import import_module
from typing import Any

from pydantic import ValidationError

from app.domain.features.purchase import Observation
from app.domain.stack_inputs import stack_eligibility
from app.schemas.history import FinancialEvent
from app.schemas.scenario import ModelInput, PaymentEvent
from ml.features.context import context_rows
from ml.features.geography import FEEDBACK_FEATURES, GEO_FEATURES, GeoEvent, geo_rows
from ml.features.history import feature_rows

CHANNELS = ("Chip Transaction", "Online Transaction", "Swipe Transaction")


class UnsupportedModelInput(ValueError):
    pass


def model_eligibility(event: FinancialEvent) -> str | None:
    return stack_eligibility(event)


def source_input(event: FinancialEvent) -> ModelInput | None:
    fields = {
        key.lower().replace(" ", "_"): value.strip() for key, value in event.source_fields.items()
    }
    fields.update(
        {key.lower().replace(" ", "_"): value.strip() for key, value in event.context.items()}
    )
    channel = fields.get("channel", fields.get("use_chip", ""))
    category = fields.get("mcc") or event.source_category or ""
    match = re.fullmatch(r"(?:MCC\s+)?([0-9]{4})", category)
    completed = event.status in (
        "completed",
        "complete",
        "posted",
        "settled",
        "success",
        "succeeded",
        "paid",
    )
    if (
        event.time_precision != "instant"
        or not event.merchant_id
        or channel not in CHANNELS
        or not match
        or (not completed and event.status not in ("failed", "declined"))
    ):
        return None
    try:
        return ModelInput.model_validate(
            {
                "channel": channel,
                "mcc": match[1],
                "completed": completed,
                "merchantState": fields.get("merchant_state", ""),
                "merchantCity": fields.get("merchant_city", ""),
                "merchantZip": fields.get("merchant_zip", fields.get("zip", "")),
            }
        )
    except ValidationError:
        return None


def feature_frame(payments: list[PaymentEvent]) -> Any:
    pd = import_module("pandas")
    observations = []
    geography = []
    accounts: dict[str, list[Observation]] = defaultdict(list)
    for payment in sorted(payments, key=lambda p: (p.occurred_at, p.id)):
        data = payment.model_input
        if data is None:
            raise UnsupportedModelInput(
                f"Payment {payment.id} is missing model inputs: channel, four-digit MCC "
                "and completion status. Imported records also require precise time and merchant ID."
            )
        seconds = datetime.fromisoformat(payment.occurred_at).timestamp()
        row = Observation(
            payment.id,
            payment.account_id,
            seconds,
            seconds,
            payment.amount_minor,
            payment.merchant_id,
            f"MCC {data.mcc}",
            data.channel,
            data.completed,
        )
        observations.append(row)
        accounts[row.account].append(row)
        geography.append(
            GeoEvent(
                row.id,
                row.account,
                seconds,
                data.merchant_state,
                data.merchant_city,
                data.merchant_zip,
                row.channel,
            )
        )
    personal = {item.id: item.values for rows in accounts.values() for item in feature_rows(rows)}
    context = dict(context_rows(observations))
    geo = dict(geo_rows(geography))
    return pd.DataFrame(
        [
            {
                "id": row.id,
                "account": row.account,
                "seconds": row.timestamp,
                **personal[row.id],
                **context[row.id],
                **dict(zip(GEO_FEATURES, geo[row.id], strict=True)),
                **dict.fromkeys(FEEDBACK_FEATURES, 0.0),
            }
            for row in observations
        ]
    )
