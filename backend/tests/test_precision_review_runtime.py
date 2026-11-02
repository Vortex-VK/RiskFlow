import base64
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.domain.card_pattern import reviews
from app.domain.engine import simulate
from app.schemas.history import DatasetCreate, ImportRequest
from app.storage.history import HistoryStore
from app.templates.catalog import load_template
from ml.artifacts import ROOT
from ml.card_pattern_runtime import BUNDLE as REVIEW_BUNDLE
from ml.card_pattern_runtime import Runtime as ReviewRuntime
from ml.card_pattern_runtime import runtime as review_runtime
from ml.features.upload_context import feature_frame
from ml.precision_runtime import BUNDLE, Runtime, runtime
from ml.runtime import ModelUnavailable
from ml.sample_inputs import payments


@pytest.fixture(scope="module")
def scenario_frame():
    raw = pd.read_csv(
        ROOT / "fixtures/evaluations/card-format-10000/unlabeled.csv",
        dtype=str,
        keep_default_na=False,
    )
    return feature_frame(payments(raw.to_dict("records")))


def test_v8_package_matches_frozen_scenario_and_reviewer_never_changes_it(scenario_frame):
    before = scenario_frame.copy(deep=True)
    scores, paths = runtime().predict(scenario_frame)
    saved = json.loads((ROOT / "fixtures/model/card-scenarios-alerts.json").read_text())
    np.testing.assert_array_equal(paths["alert"], scenario_frame.id.isin(saved["alert_ids"]))
    _, extra = review_runtime().predict(scenario_frame, paths["alert"])
    evidence = reviews(scenario_frame, paths["alert"])
    assert extra.sum() == 20
    assert sum(e is not None for e in evidence) == 20
    assert not (extra & paths["alert"]).any()
    assert not extra[scenario_frame.channel.eq("Online Transaction")].any()
    assert not extra[scenario_frame.history_samples.lt(10)].any()
    pd.testing.assert_frame_equal(scenario_frame, before)
    after_scores, after = runtime().predict(scenario_frame)
    for name in scores:
        np.testing.assert_array_equal(scores[name], after_scores[name])
    np.testing.assert_array_equal(paths["alert"], after["alert"])


def test_review_evidence_uses_only_submitted_prefix(scenario_frame):
    # Prefix comparisons retain all preceding accounts and merchant activity.
    raw = pd.read_csv(
        ROOT / "fixtures/evaluations/card-format-10000/unlabeled.csv",
        dtype=str,
        keep_default_na=False,
    )
    values = payments(raw.to_dict("records"))
    full = feature_frame(values)
    prefix = feature_frame(values[:5000])
    full_scores, full_flags = review_runtime().predict(full, np.zeros(len(full), dtype=bool))
    short_scores, short_flags = review_runtime().predict(prefix, np.zeros(len(prefix), dtype=bool))
    lookup = {identifier: i for i, identifier in enumerate(full.id)}
    idx = [lookup[identifier] for identifier in prefix.id]
    np.testing.assert_array_equal(short_scores, full_scores[idx])
    np.testing.assert_array_equal(short_flags, full_flags[idx])


@pytest.mark.parametrize("cls,bundle", [(Runtime, BUNDLE), (ReviewRuntime, REVIEW_BUNDLE)])
def test_packages_reject_missing_or_corrupt_artifacts(tmp_path: Path, cls, bundle):
    with pytest.raises(ModelUnavailable):
        cls(tmp_path)
    (tmp_path / "manifest.json").write_bytes((bundle / "manifest.json").read_bytes())
    with pytest.raises(ModelUnavailable):
        cls(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(ModelUnavailable):
        cls(tmp_path)


def test_stack_has_no_dependency_on_optional_legacy_reviewers(monkeypatch):
    scenario = load_template("shared-device-cluster").scenario
    before = simulate(scenario)

    def unavailable(*args):
        raise AssertionError("Legacy review must not run in the stack engine")

    monkeypatch.setattr("app.domain.card_pattern.reviews", unavailable)
    monkeypatch.setattr("app.domain.card_pattern.card_scores", unavailable)
    after = simulate(scenario)
    assert before == after
    assert all(e.card_pattern is None and e.card_scores is None for e in after.events)


def test_retained_card_reviews_survive_reopen_without_changing_model_recommendations(tmp_path):
    source = ROOT / "frontend/public/samples/card-pattern-demo.csv"
    store = HistoryStore(tmp_path / "review.sqlite3")
    dataset = store.create(DatasetCreate(name="Card review demo", source_namespace="authored")).id
    preview = store.preview(
        dataset,
        ImportRequest(
            filename=source.name, content_base64=base64.b64encode(source.read_bytes()).decode()
        ),
    )
    assert preview.can_commit
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    assert run.assessment_version == "assessment-v2.10"
    suggested = [a for a in run.assessments if a.card_pattern]
    assert len(suggested) == 0
    assert all(a.model.ranking for a in run.assessments)
    assert all(a.recommendation == "no_alert" and not a.model.alert for a in suggested)
    assert HistoryStore(store.path).run(dataset, run.id) == run
