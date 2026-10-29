from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.domain.engine import simulate
from app.domain.model_inputs import feature_frame
from app.main import app
from app.schemas.assessments import AssessmentRun
from app.templates.catalog import load_template
from ml.runtime import BUNDLE, ModelUnavailable, Runtime


def test_real_model_scores_are_label_and_legacy_policy_independent():
    scenario = load_template("stolen-card-burst").scenario
    baseline = simulate(scenario)
    scenario.ground_truth = {p.id: "legitimate" for p in scenario.payments}
    scenario.policy.review_threshold = 1
    scenario.policy.block_threshold = 2
    for node in scenario.nodes:
        if node.type == "account":
            node.typical_amount_minor = 1
    after = simulate(scenario)
    assert baseline.events == after.events
    assert all(e.model is not None and len(e.model.raw_scores) == 9 for e in after.events)
    assert all(e.risk_score is None and not e.rule_evaluations for e in after.events)
    assert all(e.decision == ("review" if e.model.alert else "approve") for e in after.events)
    scenario.payments[-1].amount_minor *= 10
    changed = simulate(scenario)
    assert changed.events[-1].model.raw_scores != after.events[-1].model.raw_scores
    assert [e.model.raw_scores for e in changed.events[:-1]] == [
        e.model.raw_scores for e in after.events[:-1]
    ]
    # Retrospective percentiles and queues may change when a later row changes.


def test_equal_time_feature_batches_and_account_scope_use_only_prior_history():
    scenario = load_template("everyday-purchases").scenario
    first = scenario.payments[0]
    second = first.model_copy(update={"id": "second", "amount_minor": 2000})
    later = first.model_copy(update={"id": "later", "occurred_at": "2026-10-21T12:00:00.000Z"})
    first.occurred_at = second.occurred_at = "2026-10-21T11:30:00.000Z"
    first.amount_minor = 1000
    frame = feature_frame([later, second, first]).set_index("id")
    assert frame.loc[first.id, "history_samples"] == frame.loc["second", "history_samples"] == 0
    assert frame.loc["later", "attempts_1h"] == 2
    assert frame.loc["later", "history_samples"] == 2
    assert frame.loc["later", "log_spend_24h"] == np.log1p(3000)
    second.model_input = second.model_input.model_copy(update={"completed": False})
    failed = feature_frame([first, second, later]).set_index("id")
    assert failed.loc["later", "attempts_1h"] == 2
    assert failed.loc["later", "history_samples"] == 1
    assert failed.loc["later", "prior_failure_fraction_1h"] == 0.5
    second.account_id = "different-account"
    isolated = feature_frame([first, second, later]).set_index("id")
    assert isolated.loc["later", "attempts_1h"] == 1
    assert isolated.loc["later", "merchant_distinct_accounts_1h"] == 2


def test_missing_optional_inputs_are_ranked_without_rule_fallback():
    scenario = load_template("everyday-purchases").scenario
    scenario.payments[0].model_input = None
    run = simulate(scenario)
    assert run.events[0].model.ranking and not run.events[0].model.probability_available
    response = TestClient(app).post(
        "/api/v1/simulations", json={"scenario": scenario.model_dump(by_alias=True)}
    )
    assert response.status_code == 200
    assert response.json()["events"][0]["ruleEvaluations"] == []


def test_missing_and_corrupt_artifacts_are_rejected_before_deserialization(tmp_path):
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_bytes((BUNDLE / "manifest.json").read_bytes())
    (tmp_path / "baseline-0.pkl").write_bytes(b"corrupt")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)


def test_unavailable_model_returns_503_not_a_successful_rule_score(monkeypatch):
    def unavailable():
        raise ModelUnavailable("Missing package")

    monkeypatch.setattr("app.domain.engine.runtime", unavailable)
    response = TestClient(app).post(
        "/api/v1/simulations",
        json={"scenario": load_template("everyday-purchases").scenario.model_dump(by_alias=True)},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "model_unavailable"


@pytest.mark.parametrize(
    "path",
    sorted((Path(__file__).resolve().parents[2] / "fixtures/evaluations").glob("*/*-run.json")),
)
def test_historical_assessments_remain_readable(path):
    old = AssessmentRun.model_validate_json(path.read_bytes())
    assert old.assessment_version != "assessment-v2.5"
    assert old.simulation and all(e.model is None for e in old.simulation.events)
    assert any(e.risk_score is not None for e in old.simulation.events)
