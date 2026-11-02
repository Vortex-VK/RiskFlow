from collections import defaultdict
from typing import Any, Literal

from app.domain.identity import scoped_id
from app.domain.ingestion import eligibility
from app.domain.lifecycle import reconcile_lifecycle
from app.domain.model_inputs import source_input
from app.domain.stack_inputs import history_frame, stack_eligibility
from app.domain.validation import validate_scenario
from app.schemas.history import Dataset, FinancialEvent
from app.schemas.scenario import ScenarioDocument

ADAPTER_VERSION: Literal["retained-v2"] = "retained-v2"
TAXONOMY_VERSION = "categories-v1"
EARLIEST = "1900-01-01T00:00:00.000Z"


def project_history(
    dataset: Dataset, events: list[FinancialEvent], *, model_only: bool = False
) -> ScenarioDocument:
    attempts = {
        entry.event_id
        for entry in reconcile_lifecycle(events, allow_unknown_status=model_only).entries
        if entry.attempt
    }
    inputs = {event.id: source_input(event) for event in events}
    eligible = sorted(
        (
            event
            for event in events
            if event.id in attempts
            and (stack_eligibility(event) if model_only else eligibility(event)) is None
        ),
        key=lambda event: (event.occurred_at, event.id),
    )
    nodes: dict[str, dict[str, Any]] = {}
    associations: dict[str, dict[str, Any]] = {}
    payments: list[dict[str, Any]] = []
    merchant_categories: dict[str, set[str]] = defaultdict(set)
    profiles: dict[str, dict[str, object]] = defaultdict(dict)
    precise_times = all(event.time_precision == "instant" for event in eligible)
    canonical = history_frame(eligible).to_dict("records")
    for event, inputs_row in zip(eligible, canonical, strict=True):
        source = event.source_namespace
        account = scoped_id("account", source, event.account_id)
        merchant_key = event.merchant_id or scoped_id(
            "label", event.merchant_name or "", event.merchant_country or "unknown"
        )
        merchant = scoped_id("merchant", source, merchant_key)
        device = (
            scoped_id("device", source, event.device_id)
            if event.device_id
            else scoped_id("missing_device", source, event.account_id)
        )
        location = (
            scoped_id("location", source, event.location_id)
            if event.location_id
            else scoped_id(
                "missing_location", source, event.account_id, event.location_country or "unknown"
            )
        )
        baseline = profiles[account]
        for field, value in (
            ("typicalAmountMinor", event.typical_amount_minor),
            ("usualCountryCodes", event.usual_countries),
            ("usualMerchantCategories", event.usual_categories),
        ):
            if value:
                if field in baseline and baseline[field] != value:
                    raise ValueError(
                        f"Account {event.account_id} has conflicting supplied baselines."
                    )
                baseline[field] = value
        nodes[account] = {
            "id": account,
            "type": "account",
            "name": event.account_id[:80],
            "openedAt": EARLIEST,
            "typicalAmountMinor": 5000,
            "usualCountryCodes": ["US"],
            "usualMerchantCategories": ["other"],
            **baseline,
        }
        merchant_categories[merchant].add(event.category or "other")
        merchant_node = {
            "id": merchant,
            "type": "merchant",
            "name": event.merchant_name or merchant_key[:80],
            "countryCode": event.merchant_country or "US",
            "category": "other",
        }
        if merchant in nodes and nodes[merchant] != merchant_node:
            raise ValueError(f"Merchant {merchant_key} has conflicting identity metadata.")
        nodes[merchant] = merchant_node
        nodes[device] = {
            "id": device,
            "type": "device",
            "name": (event.device_id or "Device not supplied")[:80],
        }
        location_node = {
            "id": location,
            "type": "location",
            "name": (event.location_id or event.location_country or "Location not supplied")[:80],
            "countryCode": event.location_country or "US",
        }
        if location in nodes and nodes[location] != location_node:
            raise ValueError(f"Location {event.location_id} has conflicting country metadata.")
        nodes[location] = location_node
        for kind, target, known in (
            ("accountDevice", device, event.device_known_from),
            ("accountLocation", location, event.location_known_from),
        ):
            link = scoped_id("association", account, target)
            if link not in associations:
                associations[link] = {
                    "id": link,
                    "type": kind,
                    "accountId": account,
                    "targetId": target,
                    "observedAt": min(event.occurred_at, known or event.occurred_at),
                    "knownFrom": known,
                }
            elif known != associations[link]["knownFrom"]:
                raise ValueError(
                    f"Account {event.account_id} has conflicting familiarity metadata."
                )
        unavailable: list[str] = []
        if event.typical_amount_minor is None:
            unavailable.append("unusual_amount")
        if not event.usual_categories or event.category is None:
            unavailable.append("merchant_category_deviation")
        if not event.usual_countries or not event.location_country:
            unavailable.append("unusual_location")
        if not event.device_id:
            unavailable.extend(["new_device", "shared_device_accounts"])
        if not precise_times:
            unavailable.extend(["payment_velocity", "shared_device_accounts"])
        payments.append(
            {
                "id": event.id,
                "accountId": account,
                "merchantId": merchant,
                "deviceId": device,
                "locationId": location,
                "occurredAt": event.occurred_at,
                "amountMinor": abs(event.amount_minor),
                "category": event.category,
                "sourceCategory": event.source_category,
                "modelInput": inputs[event.id],
                "rankingInput": {
                    "timePrecision": inputs_row["precision"],
                    "activityType": inputs_row["activity_type"],
                    "category": inputs_row["category"],
                    "channel": inputs_row["channel"],
                    "completed": {
                        "completed": True,
                        "posted": True,
                        "settled": True,
                        "failed": False,
                        "declined": False,
                    }.get(event.status),
                    "merchantRegion": inputs_row["merchant_region"],
                    "merchantCity": inputs_row["merchant_city"],
                    "sourcePaymentId": inputs_row["payment_id"],
                    "merchantIdProvided": bool(event.merchant_id),
                },
                "unavailableRules": sorted(set(unavailable)),
            }
        )
    for merchant, categories in merchant_categories.items():
        nodes[merchant]["category"] = next(iter(categories)) if len(categories) == 1 else "other"
    ordered_nodes = sorted(nodes.values(), key=lambda node: node["id"])
    positions = {
        node["id"]: {"x": float(140 + index % 12 * 170), "y": float(140 + index // 12 * 140)}
        for index, node in enumerate(ordered_nodes)
    }
    document = ScenarioDocument.model_validate(
        {
            "scenario": {
                "schemaVersion": 1,
                "id": dataset.id,
                "name": dataset.name,
                "description": "Retained-history projection; unavailable inputs stay unknown.",
                "scenarioStartAt": eligible[0].occurred_at if eligible else EARLIEST,
                "currency": "USD",
                "nodes": ordered_nodes,
                "associations": sorted(associations.values(), key=lambda a: a["id"]),
                "payments": payments,
                "groundTruth": {},
                "ruleSetVersion": "rules-v1",
                "policy": {"version": 1, "reviewThreshold": 40, "blockThreshold": 70},
                "costAssumptions": {
                    "approvedFraudLossBps": 10000,
                    "reviewCostMinor": 300,
                    "falseBlockCostMinor": 1500,
                },
                "seed": None,
            },
            "view": {"positions": positions, "viewport": {"x": 0.0, "y": 0.0, "zoom": 0.5}},
        }
    )
    issues = validate_scenario(document.scenario, require_complete=False)
    if issues:
        raise ValueError(" ".join(issue.message for issue in issues))
    return document
