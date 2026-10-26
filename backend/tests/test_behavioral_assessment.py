import base64
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.domain.analysis_routing import behavioral_inputs
from app.domain.features.behavioral import behavioral_rows
from app.domain.ingestion import normalize_row
from app.main import app
from app.schemas.history import DatasetCreate, ImportOptions, ImportRequest
from app.storage.history import HistoryStore

CSV = (
    "id,account,date,amount,currency,direction,type\n"
    "a,one,2026-01-01,10,USD,debit,purchase\n"
    "b,one,2026-01-02,30,USD,debit,purchase\n"
    "c,one,2026-01-03,100,USD,debit,purchase\n"
    "refund,one,2026-01-04,-10,USD,credit,refund\n"
    "other,two,2026-01-04,200,USD,debit,purchase\n"
)


def test_retained_observations_without_v13_fields_are_immutable_and_causal(tmp_path):
    store = HistoryStore(tmp_path / "behavioral.sqlite3")
    dataset = store.create(DatasetCreate(name="Observed", source_namespace="test"))
    preview = store.preview(
        dataset.id,
        ImportRequest(
            filename="observed.csv",
            content_base64=base64.b64encode(CSV.encode()).decode(),
        ),
    )
    assert preview.can_commit
    store.commit(dataset.id, preview.id)
    run = store.assess(dataset.id, 1, analysis_mode="behavioral")
    items = {item.source_event_id: item for item in run.assessments}
    assert run.simulation is None
    assert run.analysis_mode == "behavioral"
    assert all(item.score is None and item.model is None for item in run.assessments)
    assert items["a"].behavioral.history_count == 0
    assert items["c"].behavioral.history_count == 2
    assert Decimal(items["c"].behavioral.median_amount) == 10
    assert items["c"].behavioral.amount_ratio == 10
    assert items["other"].behavioral.history_count == 0
    assert items["refund"].behavioral is None
    assert store.run(dataset.id, run.id) == run
    dataset, events = store.snapshot(dataset.id, 1)
    rows, excluded = behavioral_inputs(events)
    independent = {row.id: row for row in behavioral_rows(rows)}
    for item in run.assessments:
        if item.behavioral:
            assert (
                item.behavioral.history_count == independent[item.event_id].values["history_count"]
            )
        else:
            assert item.event_id in excluded
    newer = store.assess(dataset.id, 1, analysis_mode="behavioral")
    assert newer.id != run.id and newer.analysis_hash == run.analysis_hash
    assert store.run(dataset.id, run.id) == run


def test_explicit_declarations_do_not_override_source_fields_or_invent_status():
    fields = {"source_event_id": "a", "occurred_at": "2026-01-01", "amount": "10"}
    with pytest.raises(ValueError, match="Missing required"):
        normalize_row(fields, "bank", ImportOptions())
    options = ImportOptions(
        declared_currency="USD",
        declared_single_account="one",
        declared_purchases=True,
        declared_outgoing=True,
    )
    event = normalize_row(fields, "bank", options)
    assert event.account_id == "one" and event.activity_type == "purchase"
    assert event.status == "" and event.merchant_id is None
    supplied = normalize_row(
        {
            **fields,
            "account_id": "two",
            "currency": "EUR",
            "activity_type": "refund",
            "direction": "credit",
        },
        "bank",
        options,
    )
    assert supplied.account_id == "two" and supplied.currency == "EUR"
    assert supplied.activity_type == "refund" and supplied.direction == "credit"


def test_capabilities_do_not_depend_on_v13_model_availability(monkeypatch):
    def unavailable():
        raise RuntimeError("V13 unavailable")

    monkeypatch.setattr("app.main.runtime", unavailable)
    response = TestClient(app).get("/api/v2/analysis-capabilities")
    assert response.status_code == 200
    assert response.json()["behavioralScoreKind"] == "none"


def test_labels_context_and_future_corrections_cannot_enter_observations():
    fields = {
        "source_event_id": "a",
        "occurred_at": "2026-01-01",
        "amount": "10",
        "currency": "USD",
        "account_id": "one",
        "activity_type": "purchase",
        "direction": "debit",
    }
    event = normalize_row(fields, "bank", ImportOptions())
    contaminated = event.model_copy(
        update={"context": {"isFraud": "1", "scenario": "3"}, "source_fields": {"TX_FRAUD": "1"}}
    )
    assert behavioral_inputs([event]) == behavioral_inputs([contaminated])
    correction = event.model_copy(
        update={
            "id": "correction",
            "source_event_id": "correction",
            "lifecycle_kind": "status_update",
        }
    )
    rows, excluded = behavioral_inputs([event, correction])
    assert [r.id for r in rows] == [event.id]
    assert correction.id in excluded
