import math
from pathlib import Path

import pytest

from app.schemas.simulation import RunResult


@pytest.fixture(scope="module")
def stack_case():
    run = RunResult.model_validate_json(
        (Path(__file__).resolve().parents[2] / "fixtures/runtime/stack-d5/run.json").read_bytes()
    )
    event = max(run.events, key=lambda e: e.model.ranking.raw_margin)
    return {
        "scenario": run.scenario_snapshot.model_dump(by_alias=True),
        "eventId": event.event_id,
        "modelBundleSha256": event.model.bundle_sha256,
        "expectedRawMargin": event.model.ranking.raw_margin,
    }


def test_stack_explanation_reconstructs_frozen_score_and_ignores_labels(client, stack_case):
    response = client.post("/api/v1/explanations", json=stack_case)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["method"] == "tree-shap-stack-head-v1"
    assert "probability" not in data
    assert len(data["contributions"]) == 41
    assert len(data["experts"]) == 2
    for expert in data["experts"]:
        assert math.isclose(
            expert["baseValue"] + sum(c["contribution"] for c in expert["contributions"]),
            expert["rawMargin"],
            abs_tol=1e-7,
        )
    assert math.isclose(
        data["baseValue"] + sum(c["contribution"] for c in data["contributions"]),
        stack_case["expectedRawMargin"],
        abs_tol=1e-7,
    )
    assert {f["label"] for f in data["facts"]} >= {"Purchase amount", "At this merchant"}
    scenario = {**stack_case["scenario"], "groundTruth": {}}
    changed = client.post("/api/v1/explanations", json={**stack_case, "scenario": scenario})
    assert changed.json() == data


def test_stack_explanation_rejects_wrong_snapshot_and_event(client, stack_case):
    for fields, status in [
        ({"expectedRawMargin": stack_case["expectedRawMargin"] + 1}, 409),
        ({"eventId": "absent"}, 404),
        ({"modelBundleSha256": "0" * 64}, 409),
    ]:
        assert (
            client.post("/api/v1/explanations", json={**stack_case, **fields}).status_code == status
        )


def test_stack_facts_use_strictly_prior_history_and_preserve_day_precision():
    import numpy as np
    import pandas as pd

    from ml.stack_runtime import runtime

    root = Path(__file__).resolve().parents[2] / "fixtures/runtime/stack-d5"
    data = pd.read_csv(root / "date_only.csv", dtype=str, keep_default_na=False)
    normalized, _, contributions, score, _ = runtime().explain(data, len(data) - 1)
    assert normalized.calendar_hour.isna().all()
    assert np.isclose(contributions.sum(), score)


def test_amount_comparison_excludes_equal_time_peers_and_future_rows(client, stack_case):
    import copy
    from datetime import datetime, timedelta

    scenario = copy.deepcopy(stack_case["scenario"])
    template = scenario["payments"][0]
    start = datetime.fromisoformat(template["occurredAt"].replace("Z", "+00:00"))
    scenario["payments"] = [
        {
            **template,
            "id": f"fact-{i}",
            "amountMinor": amount * 100,
            "occurredAt": (start + timedelta(hours=i))
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
        }
        for i, amount in enumerate([10, 40, 160, 640, 2560, 640])
    ]
    scenario["groundTruth"] = {}
    # These large values must not enter the factual baseline for fact-5.
    scenario["payments"] += [
        {**scenario["payments"][-1], "id": "same-time", "amountMinor": 9_000_000},
        {
            **scenario["payments"][-1],
            "id": "future",
            "amountMinor": 8_000_000,
            "occurredAt": (start + timedelta(hours=6))
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
        },
    ]
    response = client.post("/api/v1/simulations", json={"scenario": scenario})
    assert response.status_code == 200, response.text
    event = next(e for e in response.json()["events"] if e["eventId"] == "fact-5")
    explanation = client.post(
        "/api/v1/explanations",
        json={
            **stack_case,
            "scenario": scenario,
            "eventId": "fact-5",
            "expectedRawMargin": event["model"]["ranking"]["rawMargin"],
        },
    )
    assert explanation.status_code == 200, explanation.text
    facts = {f["label"]: f for f in explanation.json()["facts"]}
    assert facts["Purchase amount"]["value"] == "$640.00"
    assert "$160.00" in facts["Purchase amount"]["comparison"]
    assert "5 earlier purchases" in facts["Purchase amount"]["comparison"]
    assert facts["Previous hour"]["value"] == "1 purchase"
