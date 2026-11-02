import math
from pathlib import Path

import pytest

from app.schemas.simulation import RunResult
from ml.stack_comparison import grouped_shapley


def test_exact_grouped_shapley_distributes_interactions():
    # a = 2, b = -3, interaction = 10: each receives half the interaction.
    assert grouped_shapley([7, 9, 4, 16], 2) == pytest.approx([7, 2])
    assert grouped_shapley([16, 4, 9, 7], 2) == pytest.approx([-7, -2])
    with pytest.raises(ValueError):
        grouped_shapley([0, float("nan")], 1)


@pytest.fixture(scope="module")
def comparison_case():
    run = RunResult.model_validate_json(
        (Path(__file__).resolve().parents[2] / "fixtures/runtime/stack-d5/run.json").read_bytes()
    )
    ordered = sorted(run.events, key=lambda e: (-e.model.ranking.raw_margin, e.event_id))
    selected, reference = ordered[0], ordered[(len(ordered) - 1) // 2]
    return {
        "scenario": run.scenario_snapshot.model_dump(by_alias=True),
        "eventId": selected.event_id,
        "modelBundleSha256": selected.model.bundle_sha256,
        "expectedRawMargin": selected.model.ranking.raw_margin,
        "referenceEventId": reference.event_id,
        "expectedReferenceRawMargin": reference.model.ranking.raw_margin,
    }


def test_comparison_reconciles_real_head_attributions(client, comparison_case):
    response = client.post("/api/v1/explanations/compare", json=comparison_case)
    assert response.status_code == 200, response.text
    result = response.json()
    heads = []
    for event_id, raw in [
        (comparison_case["eventId"], comparison_case["expectedRawMargin"]),
        (comparison_case["referenceEventId"], comparison_case["expectedReferenceRawMargin"]),
    ]:
        payload = {
            k: v
            for k, v in comparison_case.items()
            if k not in {"referenceEventId", "expectedReferenceRawMargin"}
        }
        payload.update(eventId=event_id, expectedRawMargin=raw)
        head = client.post("/api/v1/explanations", json=payload)
        assert head.status_code == 200, head.text
        heads.append({row["feature"]: row["contribution"] for row in head.json()["contributions"]})
    differences = {f: heads[0][f] - heads[1][f] for f in heads[0]}
    expected = [
        f
        for f in sorted(differences, key=lambda f: (-abs(differences[f]), f))[:4]
        if f.startswith("expert_")
    ]
    assert [check["feature"] for check in result["checks"]] == expected
    assert expected
    for check in result["checks"]:
        assert check["contribution"] == pytest.approx(differences[check["feature"]], abs=1e-7)
        assert sum(row["contribution"] for row in check["observations"]) == pytest.approx(
            check["contribution"], abs=1e-7
        )
        assert check["observations"][-1]["feature"] == "other_context"
        assert 1 <= len(check["observations"]) <= 4
        assert all(row["value"] != row["referenceValue"] for row in check["observations"][:-1])
    reverse = client.post(
        "/api/v1/explanations/compare",
        json={
            **comparison_case,
            "eventId": comparison_case["referenceEventId"],
            "referenceEventId": comparison_case["eventId"],
            "expectedRawMargin": comparison_case["expectedReferenceRawMargin"],
            "expectedReferenceRawMargin": comparison_case["expectedRawMargin"],
        },
    )
    assert reverse.status_code == 200, reverse.text
    for left, right in zip(result["checks"], reverse.json()["checks"], strict=True):
        assert left["feature"] == right["feature"]
        for a, b in zip(left["observations"], right["observations"], strict=True):
            assert a["feature"] == b["feature"]
            assert math.isclose(a["contribution"], -b["contribution"], abs_tol=1e-7)
    unlabeled = client.post(
        "/api/v1/explanations/compare",
        json={**comparison_case, "scenario": {**comparison_case["scenario"], "groundTruth": {}}},
    )
    assert unlabeled.json() == result


def test_comparison_self_is_zero_and_rejects_mismatches(client, comparison_case):
    payload = {
        **comparison_case,
        "referenceEventId": comparison_case["eventId"],
        "expectedReferenceRawMargin": comparison_case["expectedRawMargin"],
    }
    response = client.post("/api/v1/explanations/compare", json=payload)
    assert response.status_code == 200, response.text
    assert all(c["contribution"] == 0 for c in response.json()["checks"])
    for change, status in [
        ({"expectedReferenceRawMargin": 100}, 409),
        ({"referenceEventId": "absent"}, 404),
        ({"modelBundleSha256": "0" * 64}, 409),
    ]:
        assert (
            client.post(
                "/api/v1/explanations/compare", json={**comparison_case, **change}
            ).status_code
            == status
        )
