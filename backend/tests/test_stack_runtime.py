import base64
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.domain.engine import simulate
from app.schemas.history import DatasetCreate, ImportRequest
from app.storage.history import HistoryStore
from ml.common import ModelUnavailable
from ml.stack_runtime import BUNDLE, Runtime, daily_queue, runtime

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures/runtime/stack-d5"


@pytest.mark.parametrize("name", ["new_customers", "optional_fields_absent", "date_only"])
def test_frozen_research_scores_and_queues_are_reproduced_without_research_imports(name):
    data = pd.read_csv(FIXTURES / (name + ".csv"), dtype=str, keep_default_na=False)
    expected = json.loads((FIXTURES / (name + ".json")).read_text())
    _, actual, selected, history = runtime().predict(data)
    for key, values in expected["margins"].items():
        np.testing.assert_allclose(actual[key], values, rtol=0, atol=1e-12)
    np.testing.assert_array_equal(selected, expected["selected"])
    np.testing.assert_array_equal(history, expected["history"])
    changed = data.iloc[::-1].copy()
    changed["is_fraud"] = 1
    _, shuffled, queue, _ = runtime().predict(changed)
    for key in actual:
        np.testing.assert_allclose(shuffled[key][::-1], actual[key], rtol=0, atol=1e-12)
    np.testing.assert_array_equal(queue[::-1], selected)


def test_per_day_ceiling_and_ties_not_aggregate_budget():
    data = pd.DataFrame(
        {"day": [0] * 101 + [1] * 2, "payment_id": [f"p{i:03}" for i in range(103)]}
    )
    selected = daily_queue(data, np.ones(103))
    assert np.flatnonzero(selected).tolist() == [0, 1, 101]


def test_missing_and_corrupt_stack_artifacts_fail_closed(tmp_path):
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_bytes((BUNDLE / "manifest.json").read_bytes())
    (tmp_path / "v2.cbm").write_bytes(b"corrupt")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)


def test_portable_upload_coverage_date_batches_reopening_and_projection_parity(tmp_path):
    csv = (
        "payment_id,account_id,counterparty_id,timestamp,amount,currency,activity_type,direction,status,channel\n"
        "a,acct,merchant,2026-01-01,20,USD,purchase,debit,completed,web\n"
        "b,acct,merchant,2026-01-01T20:00:00Z,30,USD,purchase,debit,completed,web\n"
        "c,acct,merchant,2026-01-02T10:00:00Z,50,USD,purchase,debit,,web\n"
        "transfer,acct,merchant,2026-01-03,20,USD,transfer,debit,completed,\n"
        "foreign,acct,merchant,2026-01-03,20,EUR,purchase,debit,completed,\n"
        "missing,acct,,2026-01-03,20,USD,purchase,debit,completed,\n"
    )
    store = HistoryStore(tmp_path / "stack.sqlite3")
    dataset = store.create(DatasetCreate(name="Portable", source_namespace="portable")).id
    preview = store.preview(
        dataset,
        ImportRequest(
            filename="portable.csv", content_base64=base64.b64encode(csv.encode()).decode()
        ),
    )
    assert preview.can_commit, preview.errors
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    by_source = {a.source_event_id: a for a in run.assessments}
    assert all(by_source[n].model is None for n in ["transfer", "foreign", "missing"])
    assert [by_source[n].model.history_count for n in ["a", "b", "c"]] == [0, 0, 2]
    assert by_source["c"].model.ranking.time_precision == "day"
    assert "channel" in by_source["c"].model.ranking.available_fields
    assert "category" in by_source["c"].model.ranking.missing_fields
    assert "completed" in by_source["c"].model.ranking.missing_fields
    assert sum(a.model.alert for a in run.assessments if a.model) == 2
    assert HistoryStore(store.path).run(dataset, run.id) == run
    replay = simulate(run.document.scenario)
    assert replay.events == run.simulation.events


def test_future_and_equal_time_changes_do_not_change_earlier_raw_scores():
    data = pd.read_csv(FIXTURES / "new_customers.csv", dtype=str, keep_default_na=False)
    _, before, _, _ = runtime().predict(data)
    times = pd.to_datetime(data.timestamp, utc=True)
    boundary = times.max()
    data.loc[times.eq(boundary), "amount"] = "99999"
    _, after, _, _ = runtime().predict(data)
    for key in before:
        np.testing.assert_array_equal(
            before[key][times.lt(boundary)], after[key][times.lt(boundary)]
        )
