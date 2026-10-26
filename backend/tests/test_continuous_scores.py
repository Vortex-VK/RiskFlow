import base64
import json
import math

import numpy as np
import pandas as pd
import pytest

from app.domain.card_pattern import card_scores
from app.domain.engine import simulate
from app.domain.model_scores import evidence_score
from app.schemas.history import DatasetCreate, ImportRequest
from app.storage.history import HistoryStore
from ml.artifacts import ROOT
from ml.card_priority_runtime import runtime as reviewer
from ml.features.upload_context import feature_frame
from ml.precision_runtime import runtime
from ml.sample_inputs import payments


def test_score_is_monotone_finite_and_centered_on_existing_cutoff():
    margins = [-1000, -10, -1, 0, 1, 10, 1000]
    scores = [evidence_score(x + 2, 2, "coverage") for x in margins]
    assert scores[3].value == 50
    assert [s.value for s in scores] == sorted(s.value for s in scores)
    assert len({s.value for s in scores}) == len(scores)
    assert all(math.isfinite(s.value) and 0 <= s.value <= 100 for s in scores)
    assert all(
        s.distance == x and not s.probability_available
        for s, x in zip(scores, margins, strict=True)
    )
    for invalid in [math.nan, math.inf, -math.inf]:
        with pytest.raises(ValueError):
            evidence_score(invalid, 2, "coverage")
        with pytest.raises(ValueError):
            evidence_score(0, invalid, "coverage")


def test_scores_cover_nonalerts_and_preserve_every_frozen_decision():
    raw = pd.read_csv(ROOT / "fixtures/evaluations/card-format-10000/unlabeled.csv", dtype=str)
    frame = feature_frame(payments(raw.fillna("").to_dict("records")))
    raw_scores, paths = runtime().predict(frame)
    values = card_scores(frame, paths["alert"])
    pattern_margins, proposals = reviewer().predict(frame, paths["alert"])
    priority_margins, prioritized = reviewer().prioritize(frame, proposals)
    eligible = frame.channel.ne("Online Transaction") & frame.history_samples.ge(10)
    assert sum(v is not None for v in values) == int(eligible.sum())
    assert any(v and v.pattern.distance < 0 for v in values)
    # Suppressing every suggestion must still expose the exact same underlying scores.
    suppressed = card_scores(frame, np.ones(len(frame), dtype=bool))
    for v, other in zip(values, suppressed, strict=True):
        if v:
            assert other and not other.review_suggested and not other.prioritized
            assert other.pattern == v.pattern and other.priority == v.priority
    for i, v in enumerate(values):
        if v:
            assert v.pattern.raw_margin == pattern_margins[i]
            assert v.priority.raw_margin == priority_margins[i]
            assert v.review_suggested == proposals[i]
            assert v.prioritized == prioritized[i]
    saved = json.loads((ROOT / "fixtures/model/card-scenarios-alerts.json").read_text())
    np.testing.assert_array_equal(paths["alert"], frame.id.isin(saved["alert_ids"]))
    for source, mask, cutoff in (
        ("coverage", frame.channel.ne("Online Transaction"), runtime().cards.manifest["threshold"]),
        (
            "online_specialist",
            frame.channel.eq("Online Transaction"),
            runtime().manifest["threshold"],
        ),
    ):
        projected = [evidence_score(float(m), cutoff, source) for m in raw_scores[source][mask]]
        np.testing.assert_array_equal([s.distance >= 0 for s in projected], paths["alert"][mask])
    # The new optional specialist evidence remains causal for each submitted prefix.
    short = frame.iloc[:5000].copy()
    assert card_scores(short, paths["alert"][:5000]) == values[:5000]


def test_scores_survive_retention_and_do_not_depend_on_evaluation_labels(tmp_path):
    store = HistoryStore(tmp_path / "scores.sqlite3")
    dataset = store.create(DatasetCreate(name="Scores", source_namespace="authored")).id
    source = ROOT / "frontend/public/samples/card-pattern-demo.csv"
    preview = store.preview(
        dataset,
        ImportRequest(
            filename=source.name, content_base64=base64.b64encode(source.read_bytes()).decode()
        ),
    )
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    assert all(a.model and a.model.score for a in run.assessments)
    assert all(
        a.model.probability_available and a.model.score.probability_available
        for a in run.assessments
    )
    assert any(a.card_scores and not a.card_pattern for a in run.assessments)
    assert HistoryStore(store.path).run(dataset, run.id) == run
    scenario = run.simulation.scenario_snapshot.model_copy(deep=True)
    scenario.ground_truth = {}
    unlabeled = simulate(scenario)
    assert [e.model for e in unlabeled.events] == [e.model for e in run.simulation.events]
    assert [e.card_scores for e in unlabeled.events] == [
        e.card_scores for e in run.simulation.events
    ]
