from copy import deepcopy
from typing import Any

import pytest

from app.domain.validation import validate_scenario
from app.schemas.scenario import ScenarioDefinition, ScenarioDocument
from app.templates.catalog import FIXTURE_DIRECTORY, TEMPLATE_IDS


def issues_for(document: dict[str, Any]) -> set[tuple[str, str]]:
    issues = validate_scenario(ScenarioDefinition.model_validate(document["scenario"]))
    return {(issue.path, issue.code) for issue in issues}


@pytest.mark.parametrize("template_id", TEMPLATE_IDS)
def test_canonical_templates_have_valid_references_and_timing(template_id: str) -> None:
    document = ScenarioDocument.model_validate_json(
        (FIXTURE_DIRECTORY / f"{template_id}.json").read_bytes()
    )
    assert validate_scenario(document.scenario) == []


def test_validation_does_not_mutate_scenario(document: dict[str, Any]) -> None:
    scenario = ScenarioDefinition.model_validate(document["scenario"])
    before = scenario.model_dump()
    validate_scenario(scenario)
    assert scenario.model_dump() == before


def test_ids_are_unique_across_entity_collections(document: dict[str, Any]) -> None:
    document["scenario"]["payments"][0]["id"] = "account-a"
    assert ("payments[0].id", "duplicate_id") in issues_for(document)


@pytest.mark.parametrize(
    "field,value,code",
    [
        ("merchantId", "missing", "missing_node"),
        ("deviceId", "account-a", "wrong_node_type"),
        ("locationId", "device-shared", "wrong_node_type"),
        ("accountId", "grocery", "wrong_node_type"),
    ],
)
def test_payment_references_resolve_to_correct_types(
    document: dict[str, Any], field: str, value: str, code: str
) -> None:
    document["scenario"]["payments"][0][field] = value
    assert (f"payments[0].{field}", code) in issues_for(document)


def test_duplicate_associations_are_rejected(document: dict[str, Any]) -> None:
    duplicate = deepcopy(document["scenario"]["associations"][0])
    duplicate["id"] = "another-link"
    index = len(document["scenario"]["associations"])
    document["scenario"]["associations"].append(duplicate)
    assert (f"associations[{index}]", "duplicate_association") in issues_for(document)


def test_relationship_timing_has_observation_and_opening_constraints(
    document: dict[str, Any],
) -> None:
    association = document["scenario"]["associations"][0]
    association["observedAt"] = "2024-01-01T00:00:00.000Z"
    association["knownFrom"] = "2023-01-01T00:00:00.000Z"
    assert {
        ("associations[0].observedAt", "before_account_opening"),
        ("associations[0].knownFrom", "before_observation"),
    } <= issues_for(document)


def test_payment_requires_observed_matching_context(document: dict[str, Any]) -> None:
    payment = document["scenario"]["payments"][0]
    matching = next(
        item
        for item in document["scenario"]["associations"]
        if item["accountId"] == payment["accountId"] and item["targetId"] == payment["deviceId"]
    )
    matching["observedAt"] = "2026-01-16T00:00:00.000Z"
    matching["knownFrom"] = None
    assert ("payments[0].deviceId", "context_not_observed") in issues_for(document)
    document["scenario"]["associations"].remove(matching)
    assert ("payments[0].deviceId", "missing_association") in issues_for(document)


def test_observation_at_payment_time_is_usable_and_future_familiarity_is_allowed(
    document: dict[str, Any],
) -> None:
    payment = document["scenario"]["payments"][0]
    matching = next(
        item
        for item in document["scenario"]["associations"]
        if item["accountId"] == payment["accountId"] and item["targetId"] == payment["deviceId"]
    )
    matching["observedAt"] = payment["occurredAt"]
    matching["knownFrom"] = "2026-01-16T00:00:00.000Z"
    assert issues_for(document) == set()


def test_payment_cannot_precede_start_or_opening(document: dict[str, Any]) -> None:
    document["scenario"]["payments"][0]["occurredAt"] = "2024-01-01T00:00:00.000Z"
    assert {
        ("payments[0].occurredAt", "before_scenario_start"),
        ("payments[0].occurredAt", "before_account_opening"),
    } <= issues_for(document)


def test_dangling_labels_and_reversed_policy_are_explained(document: dict[str, Any]) -> None:
    document["scenario"]["groundTruth"]["missing-event"] = "fraudulent"
    document["scenario"]["policy"]["reviewThreshold"] = 70
    assert {
        ("groundTruth.missing-event", "missing_payment"),
        ("policy.reviewThreshold", "threshold_order"),
    } <= issues_for(document)


def test_incomplete_draft_can_be_saved_but_not_simulated(document: dict[str, Any]) -> None:
    document["scenario"].update(nodes=[], associations=[], payments=[], groundTruth={})
    scenario = ScenarioDefinition.model_validate(document["scenario"])
    assert validate_scenario(scenario, require_complete=False) == []
    issues = validate_scenario(scenario)
    assert [issue.code for issue in issues] == ["required_node_type"] * 4 + ["required_payment"]


def test_duplicate_payment_endpoints_and_times_remain_distinct(document: dict[str, Any]) -> None:
    payment = deepcopy(document["scenario"]["payments"][0])
    payment["id"] = "independent-attempt"
    document["scenario"]["payments"].append(payment)
    assert issues_for(document) == set()
