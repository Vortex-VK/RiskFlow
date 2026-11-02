import math
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.schemas.simulation import RunResult
from app.templates.catalog import load_template
from ml.adaptation_runtime import MANIFEST_SHA256


@pytest.fixture(scope="module")
def explanation_case():
    scenario = load_template("shared-device-cluster").scenario
    run = RunResult.model_validate_json(
        (
            Path(__file__).resolve().parents[2]
            / "fixtures/runtime/shared-device-cluster-upload-v9.json"
        ).read_bytes()
    )
    event = max(run.events, key=lambda e: e.model.score.value)
    return scenario, event


def request_for(scenario, event):
    return {
        "scenario": scenario.model_dump(by_alias=True),
        "eventId": event.event_id,
        "modelBundleSha256": MANIFEST_SHA256,
        "expectedRawMargin": event.model.score.raw_margin,
    }


def test_public_demo_rejects_historical_models_before_loading(
    client, monkeypatch, explanation_case
):
    scenario, event = explanation_case
    explain = Mock(side_effect=AssertionError("Historical models must not load in the public demo"))
    monkeypatch.setattr("app.main.public_demo", True)
    monkeypatch.setattr("app.main.explain_payment", explain)
    response = client.post("/api/v1/explanations", json=request_for(scenario, event))
    assert response.status_code == 409
    explain.assert_not_called()


def test_shap_reconstructs_saved_prediction_and_ignores_labels(
    client: TestClient, explanation_case
):
    scenario, event = explanation_case
    payload = request_for(scenario, event)
    response = client.post("/api/v1/explanations", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["eventId"] == event.event_id
    assert result["method"] == "tree-shap-final-head-v1"
    assert math.isclose(result["rawMargin"], event.model.score.raw_margin, abs_tol=1e-7)
    assert math.isclose(result["probability"], event.model.score.value, abs_tol=1e-7)
    assert math.isclose(
        result["baseValue"] + sum(row["contribution"] for row in result["contributions"]),
        result["rawMargin"],
        abs_tol=1e-7,
    )
    assert any(row["contribution"] > 0 for row in result["contributions"])
    assert any(row["contribution"] < 0 for row in result["contributions"])
    payload["scenario"]["groundTruth"] = {}
    assert client.post("/api/v1/explanations", json=payload).json() == result
    payload["scenario"]["payments"] = [
        p for p in payload["scenario"]["payments"] if p["occurredAt"] <= event.occurred_at
    ]
    assert client.post("/api/v1/explanations", json=payload).json() == result


def test_explanation_rejects_wrong_model_missing_event_and_unreproducible_score(
    client: TestClient,
    explanation_case,
):
    scenario, event = explanation_case
    for changed, status in [
        ({"modelBundleSha256": "0" * 64}, 409),
        ({"expectedRawMargin": event.model.score.raw_margin + 1}, 409),
        ({"eventId": "missing-payment"}, 404),
    ]:
        response = client.post(
            "/api/v1/explanations", json={**request_for(scenario, event), **changed}
        )
        assert response.status_code == status, response.text
