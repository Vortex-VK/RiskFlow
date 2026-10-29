import base64
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.schemas.history import DatasetCreate, ImportRequest
from app.storage.history import HistoryStore
from ml.artifacts import ROOT
from ml.card_pattern_runtime import runtime as original
from ml.card_priority_runtime import BUNDLE, Runtime, runtime
from ml.features.upload_context import feature_frame
from ml.runtime import ModelUnavailable
from ml.sample_inputs import payments


@pytest.fixture(scope="module")
def purchases():
    raw = pd.read_csv(
        ROOT / "frontend/public/samples/card-pattern-demo.csv", dtype=str, keep_default_na=False
    )
    return payments(raw.to_dict("records"))


def test_priority_preserves_every_original_lead_and_is_strictly_prior(purchases):
    full = feature_frame(purchases)
    before = full.copy(deep=True)
    alerts = np.zeros(len(full), dtype=bool)
    old_scores, old_flags = original().predict(full, alerts)
    scores, flags = runtime().predict(full, alerts)
    priority_scores, priority = runtime().prioritize(full, flags)
    np.testing.assert_array_equal(scores, old_scores)
    np.testing.assert_array_equal(flags, old_flags)
    assert not (priority & ~flags).any()
    prefix = feature_frame(purchases[:150])
    _, prefix_flags = runtime().predict(prefix, alerts[: len(prefix)])
    prefix_scores, prefix_priority = runtime().prioritize(prefix, prefix_flags)
    idx = [list(full.id).index(identifier) for identifier in prefix.id]
    np.testing.assert_array_equal(priority_scores[idx], prefix_scores)
    np.testing.assert_array_equal(priority[idx], prefix_priority)
    pd.testing.assert_frame_equal(full, before)


def test_priority_rejects_missing_and_corrupt_packages(tmp_path: Path):
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_bytes((BUNDLE / "manifest.json").read_bytes())
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)


def test_stack_ranking_replaces_extra_card_queue_and_survives_storage(tmp_path: Path):
    source = ROOT / "frontend/public/samples/card-pattern-demo.csv"
    store = HistoryStore(tmp_path / "priority.sqlite3")
    dataset = store.create(DatasetCreate(name="Priority", source_namespace="authored")).id
    preview = store.preview(
        dataset,
        ImportRequest(
            filename=source.name, content_base64=base64.b64encode(source.read_bytes()).decode()
        ),
    )
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    assert all(a.card_pattern is None for a in run.assessments)
    assert all(a.model.ranking and not a.model.probability_available for a in run.assessments)
    assert HistoryStore(store.path).run(dataset, run.id) == run
