"""Read the checked IBM-format examples for offline verification and sample tooling.

The web application's importers validate arbitrary uploads separately. Outcome
columns are deliberately ignored here and never become model inputs.
"""

from decimal import Decimal

from app.schemas.scenario import PaymentEvent


def payments(rows: list[dict[str, str]]) -> list[PaymentEvent]:
    return [
        PaymentEvent.model_validate(
            {
                "id": f"CSV_{i + 2:03}",
                "accountId": f"user-{r['User']}-card-{r['Card']}",
                "merchantId": r["Merchant Name"],
                "deviceId": "unknown",
                "locationId": "unknown",
                "occurredAt": (
                    f"{int(r['Year']):04}-{int(r['Month']):02}-"
                    f"{int(r['Day']):02}T{r['Time']}:00.000Z"
                ),
                "amountMinor": int(Decimal(r["Amount"].replace("$", "")) * 100),
                "modelInput": {
                    "channel": r["Use Chip"],
                    "mcc": r["MCC"],
                    "completed": not r["Errors?"].strip(),
                    "merchantState": r["Merchant State"],
                    "merchantCity": r["Merchant City"],
                    "merchantZip": r["Zip"],
                },
            }
        )
        for i, r in enumerate(rows)
    ]
