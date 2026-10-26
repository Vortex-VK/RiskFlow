import base64
import binascii
import csv
import hashlib
import io
import json
import re
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from pydantic import ValidationError

from app.domain.identity import scoped_id
from app.schemas.history import FinancialEvent, ImportOptions, ImportRequest, ImportRow
from app.schemas.scenario import Category

MAX_SOURCE_BYTES = 5 * 1024 * 1024
MAX_SOURCE_ROWS = 20_000
ALIASES = {
    "source_event_id": ("transaction_id", "event_id", "payment_id", "id", "source_event_id"),
    "account_id": ("account_id", "account", "account_number", "customer_id"),
    "occurred_at": ("timestamp", "occurred_at", "date", "transaction_date", "posted_date"),
    "amount": ("amount", "amount_usd", "gross", "transaction_amount", "transactionamt"),
    "debit": ("debit", "debit_amount"),
    "credit": ("credit", "credit_amount"),
    "time": ("time", "transaction_time"),
    "year": ("year",),
    "month": ("month",),
    "day": ("day",),
    "user": ("user",),
    "card": ("card",),
    "card_errors": ("errors?",),
    "channel": ("channel", "use chip", "use_chip"),
    "mcc": ("mcc",),
    "merchant_city": ("merchant_city", "merchant city"),
    "merchant_state": ("merchant_state", "merchant state"),
    "merchant_zip": ("merchant_zip", "zip"),
    "currency": ("currency", "currency_code"),
    "direction": ("direction", "debit_credit"),
    "activity_type": ("transaction_type", "type", "reporting_category"),
    "status": ("status", "transaction_status"),
    "merchant_id": ("merchant_id", "payee_id"),
    "merchant_name": ("merchant_name", "merchant name", "merchant", "payee", "description", "name"),
    "source_category": ("merchant_category", "category"),
    "merchant_country": ("merchant_country", "merchant_country_code"),
    "device_id": ("device_id", "device"),
    "location_id": ("location_id",),
    "location_country": ("location_country", "location_country_code"),
    "source_available_at": ("source_available_at",),
    "underlying_transaction_id": ("underlying_transaction_id",),
    "lifecycle_kind": ("lifecycle_kind", "event_kind"),
    "related_event_id": ("related_event_id", "parent_event_id"),
    "device_known_from": ("device_known_from",),
    "device_trust_state": ("device_trust_state",),
    "device_trust_effective_at": ("device_trust_effective_at",),
    "device_trust_provenance": ("device_trust_provenance",),
    "location_known_from": ("location_known_from",),
    "typical_amount": ("typical_amount",),
    "usual_countries": ("usual_countries", "usual_country_codes"),
    "usual_categories": ("usual_categories", "usual_merchant_categories"),
}
CATEGORIES: dict[str, Category] = {
    "groceries": "groceries",
    "supermarket": "groceries",
    "retail": "retail",
    "shopping": "retail",
    "dining": "dining",
    "restaurants": "dining",
    "transport": "transport",
    "fuel": "transport",
    "utilities": "utilities",
    "travel": "travel",
    "electronics": "electronics",
    "other": "other",
}


def parse_money(value: str, separator: str) -> int:
    text = re.sub(r"^USD\s*|\s*USD$", "", value.strip(), flags=re.IGNORECASE).strip()
    text = re.sub(r"^\$\s*([+-])\s*(?=\d)", r"\1$", text)
    sign = 1
    if text.startswith("(") and text.endswith(")"):
        sign, text = -1, text[1:-1].strip()
    elif text.startswith(("-", "+")):
        sign, text = (-1 if text[0] == "-" else 1), text[1:]
    text = re.sub(r"^(?:USD\s*|\$\s*)", "", text, flags=re.IGNORECASE)
    pattern = (
        r"(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?"
        if separator == "."
        else (r"(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?")
    )
    if not re.fullmatch(pattern, text):
        raise ValueError("Amount does not match the selected format or exceeds two decimal places.")
    normalized = (
        text.replace(",", "") if separator == "." else text.replace(".", "").replace(",", ".")
    )
    try:
        return sign * int(Decimal(normalized) * 100)
    except InvalidOperation as exc:
        raise ValueError("Invalid amount.") from exc


def parse_time(value: str, options: ImportOptions) -> tuple[str, bool]:
    date_only = bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value))
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        if options.date_order == "iso":
            raise ValueError("Use ISO dates or select the source date order.") from None
        pattern = "%m/%d/%Y" if options.date_order == "mdy" else "%d/%m/%Y"
        date_only = " " not in value
        parsed = datetime.strptime(value, pattern if date_only else pattern + " %H:%M:%S")
    if parsed.tzinfo is None:
        if not date_only and options.utc_offset_minutes is None:
            raise ValueError("Timestamp has no timezone; select its UTC offset.")
        parsed = parsed.replace(tzinfo=timezone(timedelta(minutes=options.utc_offset_minutes or 0)))
    if parsed.microsecond % 1000:
        raise ValueError(
            "Sub-millisecond timestamps are not supported; precision was not truncated."
        )
    return parsed.astimezone(UTC).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    ), date_only


def eligibility(event: FinancialEvent) -> str | None:
    if event.lifecycle_kind in {"capture", "refund", "reversal", "status_update"}:
        return "Lifecycle record is retained for accounting, not counted as a new attempt."
    if event.currency != "USD":
        return "Currency is retained but V1 analysis supports USD only."
    if event.activity_type not in {
        "purchase",
        "payment",
        "charge",
        "bill_payment",
        "authorization",
    }:
        return "This activity type has no validated rule adapter yet."
    if event.direction not in {"debit", "out", "outgoing"}:
        return "Incoming or unknown-direction activity is not evaluated as a purchase."
    if event.status not in {
        "completed",
        "complete",
        "posted",
        "settled",
        "success",
        "succeeded",
        "paid",
        "pending",
        "declined",
        "failed",
        "authorized",
    }:
        return "This lifecycle status is not supported by the attempt-based V1 adapter."
    if event.amount_minor == 0:
        return "Zero-value activity is retained without a purchase score."
    if not (event.merchant_id or event.merchant_name):
        return "Purchase counterparty is missing."
    return None


def normalize_row(fields: dict[str, str], namespace: str, options: ImportOptions) -> FinancialEvent:
    fields = dict(fields)
    for key, value in (
        ("currency", options.declared_currency),
        ("account_id", options.declared_single_account),
        ("activity_type", "purchase" if options.declared_purchases else None),
        ("direction", "debit" if options.declared_outgoing else None),
    ):
        if not fields.get(key) and value is not None:
            fields[key] = value
    if not fields.get("occurred_at") and any(key in fields for key in ("year", "month", "day")):
        year, month, day = (fields.get(key, "") for key in ("year", "month", "day"))
        if not (
            re.fullmatch(r"\d{4}", year)
            and re.fullmatch(r"\d{1,2}", month)
            and re.fullmatch(r"\d{1,2}", day)
        ):
            raise ValueError("Year, Month and Day must contain numeric calendar components.")
        fields["occurred_at"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    if not fields.get("amount") and (fields.get("debit") or fields.get("credit")):
        debit = parse_money(fields.get("debit") or "0", options.decimal_separator)
        credit = parse_money(fields.get("credit") or "0", options.decimal_separator)
        if debit < 0 or credit < 0 or (debit and credit):
            raise ValueError(
                "Separate debit/credit values must be nonnegative with only one nonzero side."
            )
        fields["amount"] = str(Decimal(debit or credit) / 100).replace(
            ".", options.decimal_separator
        )
        side = "debit" if debit else "credit" if credit else ""
        supplied = fields.get("direction", "").lower()
        allowed = {"debit", "out", "outgoing"} if side == "debit" else {"credit", "in", "incoming"}
        if side and supplied and supplied not in allowed:
            raise ValueError("Direction conflicts with the populated debit/credit column.")
        fields["direction"] = supplied or side
    if fields.get("time"):
        date = fields.get("occurred_at", "")
        if not re.fullmatch(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", date):
            raise ValueError("A separate time column requires a date-only date column.")
        fields["occurred_at"] = date + ("T" if "-" in date else " ") + fields["time"]
    required = ("source_event_id", "account_id", "occurred_at", "amount", "currency")
    missing = [key for key in required if not fields.get(key)]
    if missing:
        raise ValueError("Missing required values: " + ", ".join(missing))
    timestamp, date_only = parse_time(fields["occurred_at"], options)
    category = fields.get("source_category", "")
    extra: dict[str, object] = {}
    for key in (
        "source_available_at",
        "device_known_from",
        "location_known_from",
        "device_trust_effective_at",
    ):
        if fields.get(key):
            instant, is_date = parse_time(fields[key], options)
            if is_date:
                raise ValueError(f"{key} requires a timestamp, not a date.")
            extra[key] = instant
    if fields.get("typical_amount"):
        extra["typical_amount_minor"] = parse_money(
            fields["typical_amount"], options.decimal_separator
        )
    for key in (
        "merchant_id",
        "merchant_name",
        "device_id",
        "location_id",
        "underlying_transaction_id",
        "related_event_id",
        "device_trust_provenance",
    ):
        extra[key] = fields.get(key) or None
    for key in ("merchant_country", "location_country"):
        extra[key] = fields.get(key, "").upper() or None
    countries = sorted(set(filter(None, re.split(r"[|; ]+", fields.get("usual_countries", "")))))
    category_names = sorted(
        set(filter(None, re.split(r"[|;]+", fields.get("usual_categories", ""))))
    )
    return FinancialEvent.model_validate(
        {
            "id": scoped_id("event", namespace, fields["account_id"], fields["source_event_id"]),
            "source_event_id": fields["source_event_id"],
            "source_namespace": namespace,
            "account_id": fields["account_id"],
            "occurred_at": timestamp,
            "time_precision": "date" if date_only else "instant",
            "amount_minor": parse_money(fields["amount"], options.decimal_separator),
            "currency": fields["currency"].upper(),
            "direction": fields.get("direction", "").lower(),
            "activity_type": fields.get("activity_type", "").lower(),
            "status": fields.get("status", "").lower(),
            "lifecycle_kind": fields.get("lifecycle_kind", "").lower() or "unspecified",
            "device_trust_state": fields.get("device_trust_state", "").lower() or "unknown",
            "source_category": category or None,
            "category": CATEGORIES.get(category.lower(), "other") if category else None,
            "usual_countries": [country.upper() for country in countries],
            "usual_categories": category_names,
            "source_fields": {},
            **extra,
        }
    )


def read_import(
    request: ImportRequest,
    namespace: str,
) -> tuple[str, dict[str, str], list[tuple[int, FinancialEvent]], list[ImportRow]]:
    try:
        raw = base64.b64decode(request.content_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("CSV upload is not valid base64.") from exc
    if len(raw) > MAX_SOURCE_BYTES:
        raise ValueError("CSV files must be at most 5 MiB.")
    try:
        decoded = raw.decode(
            "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        )
    except UnicodeError as exc:
        raise ValueError("Use UTF-8 or BOM-marked UTF-16 CSV.") from exc
    if any((ord(char) < 32 and char not in "\t\r\n") or ord(char) == 127 for char in decoded):
        raise ValueError("CSV contains binary or control characters; export a fresh text CSV.")
    delimiter: str = request.options.delimiter
    if decoded.startswith("sep="):
        first, _, decoded = decoded.partition("\n")
        if delimiter == "auto" and first[4:].strip("\r") in {",", ";", "\t"}:
            delimiter = first[4:].strip("\r")
    if delimiter == "auto":
        try:
            delimiter = csv.Sniffer().sniff(decoded[:8192], delimiters=",;\t").delimiter
        except csv.Error as exc:
            raise ValueError("Could not detect CSV delimiter; select it explicitly.") from exc
    reader = csv.reader(io.StringIO(decoded), delimiter=delimiter, strict=True)
    try:
        headers = next(reader)
    except (StopIteration, csv.Error) as exc:
        raise ValueError("CSV needs a header and data rows.") from exc
    headers = [header.strip() for header in headers]
    normalized = [header.lower() for header in headers]
    if len(set(normalized)) != len(headers) or any(not header for header in headers):
        raise ValueError("CSV headers must be nonempty and unique.")
    mapping = {}
    for key, aliases in ALIASES.items():
        match = next((alias for alias in aliases if alias in normalized), None)
        if match is not None:
            mapping[key] = headers[normalized.index(match)]
    for key, header in request.options.columns.items():
        if key not in ALIASES or header not in headers:
            raise ValueError(f"Unknown mapping: {key} -> {header}.")
        mapping[key] = header
    card_export = all(
        key in mapping
        for key in (
            "user",
            "card",
            "year",
            "month",
            "day",
            "time",
            "channel",
            "mcc",
            "card_errors",
        )
    ) and ("merchant_id" in mapping or "merchant_name" in mapping)
    if card_export and "merchant_id" not in mapping:
        mapping["merchant_id"] = mapping.pop("merchant_name")
    options = request.options
    if card_export and options.utc_offset_minutes is None:
        options = options.model_copy(update={"utc_offset_minutes": 0})
    occurrences: dict[str, int] = {}
    events: list[tuple[int, FinancialEvent]] = []
    invalid: list[ImportRow] = []
    try:
        for number, cells in enumerate(reader, 2):
            if number > MAX_SOURCE_ROWS + 1:
                raise ValueError("An import supports at most 20,000 source rows.")
            source = dict(zip(headers, cells, strict=False))
            fields = {key: source.get(header, "").strip() for key, header in mapping.items()}
            try:
                if len(cells) != len(headers):
                    raise ValueError("Row does not match the header column count.")
                if card_export:
                    if not all(re.fullmatch(r"\d+", fields[key]) for key in ("user", "card")):
                        raise ValueError("Card exports require numeric User and Card values.")
                    # Labels and auxiliary ground-truth columns never enter identity or predictors.
                    identity = {
                        key: fields.get(key, "")
                        for key in (
                            "user",
                            "card",
                            "year",
                            "month",
                            "day",
                            "time",
                            "amount",
                            "channel",
                            "merchant_id",
                            "mcc",
                            "card_errors",
                            "merchant_city",
                            "merchant_state",
                            "merchant_zip",
                        )
                    }
                    digest = hashlib.sha256(
                        json.dumps(identity, sort_keys=True).encode()
                    ).hexdigest()
                    occurrences[digest] = occurrences.get(digest, 0) + 1
                    signed = parse_money(fields.get("amount", ""), options.decimal_separator)
                    fields.setdefault(
                        "source_event_id", f"card-{digest[:40]}-{occurrences[digest]}"
                    )
                    fields.setdefault(
                        "account_id", f"ibm-user-{fields['user']}-card-{fields['card']}"
                    )
                    fields.setdefault("merchant_name", fields["merchant_id"][:80])
                    fields.setdefault("currency", "USD")
                    fields.setdefault("direction", "credit" if signed < 0 else "debit")
                    fields.setdefault(
                        "activity_type", "credit_adjustment" if signed < 0 else "purchase"
                    )
                    fields.setdefault("status", "failed" if fields["card_errors"] else "completed")
                    fields.setdefault("source_category", f"MCC {fields['mcc']}")
                event = normalize_row(fields, namespace, options)
                context = {
                    key.lower(): value.strip()
                    for key, value in source.items()
                    if key not in mapping.values() and value.strip()
                }
                context.update(
                    {
                        key: fields[key]
                        for key in (
                            "channel",
                            "mcc",
                            "merchant_city",
                            "merchant_state",
                            "merchant_zip",
                        )
                        if key in fields
                    }
                )
                if card_export:
                    context["card_export_assumptions"] = (
                        "User+Card account; USD; blank Errors? completed, otherwise failed; "
                        "negative amount incoming adjustment; content identity excludes labels; "
                        f"source clock uses UTC offset {options.utc_offset_minutes} minutes."
                    )
                events.append(
                    (number, event.model_copy(update={"source_fields": source, "context": context}))
                )
            except (ValueError, ValidationError) as exc:
                reason = str(exc)
                if isinstance(exc, ValidationError):
                    reason = "; ".join(f"{e['loc'][0]}: {e['msg']}" for e in exc.errors())
                invalid.append(
                    ImportRow(
                        row=number,
                        source_event_id=(fields.get("source_event_id") or "")[:200] or None,
                        disposition="invalid",
                        analytical_status="invalid",
                        reason=reason,
                        event_id=None,
                    )
                )
    except csv.Error as exc:
        raise ValueError(f"Invalid CSV structure: {exc}") from exc
    if not events and not invalid:
        raise ValueError("CSV contains no data rows.")
    return hashlib.sha256(raw).hexdigest(), mapping, events, invalid
