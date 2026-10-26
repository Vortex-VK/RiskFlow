from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas.scenario import ScenarioDefinition, ScenarioDocument
from app.templates.catalog import TEMPLATE_IDS, load_template


@pytest.mark.parametrize("template_id", TEMPLATE_IDS)
def test_fixture_round_trip_preserves_context_and_canonical_timestamps(template_id: str) -> None:
    document = load_template(template_id)
    decoded = ScenarioDocument.model_validate_json(document.model_dump_json(by_alias=True))
    assert decoded == document
    assert all(payment.occurred_at.endswith(".000Z") for payment in decoded.scenario.payments)
    assert decoded.scenario.seed is None


@pytest.mark.parametrize("amount", [True, "24000", 24000.0, 0, -1, 100_000_001])
def test_money_rejects_coercion_and_out_of_range_values(
    document: dict[str, Any], amount: object
) -> None:
    document["scenario"]["payments"][0]["amountMinor"] = amount
    with pytest.raises(ValidationError) as error:
        ScenarioDocument.model_validate(document)
    assert error.value.errors()[0]["loc"] == ("scenario", "payments", 0, "amountMinor")


@pytest.mark.parametrize(
    "timestamp",
    [
        "2026-01-15T10:00:00Z",
        "2026-01-15T10:00:00.000+00:00",
        "2026-01-15T10:00:00.0000Z",
        "2026-02-30T10:00:00.000Z",
        "2026-01-15T10:00:60.000Z",
        "1899-12-31T23:59:59.999Z",
        "2101-01-01T00:00:00.000Z",
        1_768_474_800,
    ],
)
def test_timestamp_rejects_noncanonical_or_invalid_dates(
    document: dict[str, Any], timestamp: object
) -> None:
    document["scenario"]["payments"][0]["occurredAt"] = timestamp
    with pytest.raises(ValidationError) as error:
        ScenarioDocument.model_validate(document)
    assert error.value.errors()[0]["loc"] == ("scenario", "payments", 0, "occurredAt")


@pytest.mark.parametrize(
    "identifier", ["__proto__", "prototype", "constructor", "x.y", "é", "x" * 65]
)
def test_identifiers_are_safe_ascii_keys(document: dict[str, Any], identifier: str) -> None:
    document["scenario"]["id"] = identifier
    with pytest.raises(ValidationError):
        ScenarioDocument.model_validate(document)


@pytest.mark.parametrize("version", [True, "1", 1.0, 2])
def test_schema_version_is_a_strict_supported_integer(
    document: dict[str, Any], version: object
) -> None:
    document["scenario"]["schemaVersion"] = version
    with pytest.raises(ValidationError):
        ScenarioDocument.model_validate(document)


def test_unknown_fields_and_unsupported_node_types_are_rejected(document: dict[str, Any]) -> None:
    document["scenario"]["nodes"][0]["type"] = "bank"
    document["scenario"]["riskScore"] = 99
    with pytest.raises(ValidationError) as error:
        ScenarioDocument.model_validate(document)
    assert {item["type"] for item in error.value.errors()} == {
        "union_tag_invalid",
        "extra_forbidden",
    }


@pytest.mark.parametrize("countries", [["ZZ"], ["us"], [], ["US", "US"]])
def test_account_country_baseline_is_valid_nonempty_and_unique(
    document: dict[str, Any], countries: list[str]
) -> None:
    document["scenario"]["nodes"][0]["usualCountryCodes"] = countries
    with pytest.raises(ValidationError):
        ScenarioDocument.model_validate(document)


def test_saved_view_requires_exact_node_positions(document: dict[str, Any]) -> None:
    del document["view"]["positions"]["account-a"]
    document["view"]["positions"]["missing-node"] = {"x": 0, "y": 0}
    with pytest.raises(ValidationError, match="match the scenario nodes exactly"):
        ScenarioDocument.model_validate(document)


@pytest.mark.parametrize("coordinate", [float("nan"), float("inf"), 1_000_000, "25", True])
def test_view_rejects_unusable_coordinates(document: dict[str, Any], coordinate: object) -> None:
    document["view"]["positions"]["account-a"]["x"] = coordinate
    with pytest.raises(ValidationError):
        ScenarioDocument.model_validate(document)


@pytest.mark.parametrize(
    "collection,limit", [("nodes", 1000), ("payments", 10_000), ("associations", 20_000)]
)
def test_collection_limits_are_enforced(
    document: dict[str, Any], collection: str, limit: int
) -> None:
    document["scenario"][collection] = [document["scenario"][collection][0]] * (limit + 1)
    with pytest.raises(ValidationError) as error:
        ScenarioDocument.model_validate(document)
    assert error.value.errors()[0]["type"] == "too_long"


def test_incomplete_draft_is_structurally_valid(document: dict[str, Any]) -> None:
    scenario = document["scenario"]
    scenario.update(nodes=[], associations=[], payments=[], groundTruth={})
    assert ScenarioDefinition.model_validate(scenario).payments == []
