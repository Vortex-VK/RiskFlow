import base64
import csv
import io
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.domain.identity import canonical_hash
from app.main import app
from app.schemas.history import CorrectionRequest, DatasetCreate, ImportOptions, ImportRequest
from app.storage.history import HistoryConflict, HistoryStore


def row(identifier: str, kind: str = "authorization", **values: str) -> dict[str, str]:
    return {
        "event_id": identifier,
        "account_id": "A",
        "timestamp": "2026-10-01T10:00:00.000Z",
        "source_available_at": "2026-10-01T10:00:00.000Z",
        "amount": "100.00",
        "currency": "USD",
        "direction": "debit",
        "transaction_type": "purchase",
        "status": "completed",
        "merchant_id": "M",
        "merchant_category": "MCC 5411",
        "channel": "Chip Transaction",
        "lifecycle_kind": kind,
        "underlying_transaction_id": "purchase-1",
        "related_event_id": "",
        **values,
    }


def upload(*rows: dict[str, str]) -> ImportRequest:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(dict.fromkeys(k for r in rows for k in r)))
    writer.writeheader()
    writer.writerows(rows)
    return ImportRequest(
        filename="lifecycle.csv",
        content_base64=base64.b64encode(output.getvalue().encode()).decode(),
    )


@pytest.fixture
def history(tmp_path: Path) -> tuple[HistoryStore, str]:
    store = HistoryStore(tmp_path / "history.sqlite3")
    dataset = store.create(DatasetCreate(name="Lifecycle", source_namespace="bank"))
    return store, dataset.id


def commit(store: HistoryStore, dataset: str, *rows: dict[str, str]) -> None:
    preview = store.preview(dataset, upload(*rows))
    assert preview.can_commit, preview.errors
    store.commit(dataset, preview.id)


def correction(store: HistoryStore, dataset: str, *rows: dict[str, str]):
    preview = store.preview(dataset, upload(*rows))
    assert not preview.can_commit
    return store.resolve(
        dataset,
        preview.id,
        CorrectionRequest(
            expected_revision=store.dataset(dataset).revision,
            event_ids=list(
                {item.event_id for item in preview.rows if item.disposition == "conflict"}
            ),
            reason="Provider corrected the source record",
        ),
    )


def test_attempts_captures_partial_refunds_and_reversals_have_separate_populations(history):
    store, dataset = history
    records = [
        row("decline", status="declined"),
        row("auth"),
        row("capture-1", "capture", amount="60", related_event_id="auth"),
        row("capture-2", "capture", amount="40", related_event_id="auth"),
        row("refund", "refund", amount="20", direction="credit", related_event_id="capture-1"),
        row("reverse", "reversal", amount="40", direction="credit", related_event_id="capture-1"),
        row("update", "status_update", related_event_id="auth"),
        row("release", "reversal", related_event_id="auth"),
    ]
    commit(store, dataset, *records)
    result = store.assess(dataset, 1)
    population = result.lifecycle.currencies[0]
    assert population.model_dump() == {
        "currency": "USD",
        "attempt_count": 2,
        "settled_minor": 10000,
        "refunded_minor": 2000,
        "reversed_minor": 4000,
        "net_outflow_minor": 4000,
        "unresolved_count": 0,
        "excluded_count": 0,
    }
    assert len(result.simulation.events) == 2
    assert sorted(event.model.history_count for event in result.simulation.events) == [0, 0]
    assert sum(item.model is None for item in result.assessments) == 6
    by_id = {item.source_event_id: item for item in result.lifecycle.entries}
    assert by_id["release"].reversed_minor == 0
    assert by_id["capture-1"].related_event_id == by_id["auth"].event_id
    commit(store, dataset, *records)
    assert store.dataset(dataset).revision == 1
    assert store.assess(dataset, 1).analysis_hash == result.analysis_hash


@pytest.mark.parametrize(
    "changes, expected",
    [
        ({"related_event_id": "missing"}, "absent"),
        ({"account_id": "other"}, "absent"),
        ({"currency": "EUR"}, "incompatible"),
        ({"underlying_transaction_id": "another"}, "incompatible"),
        ({"timestamp": "2026-10-01T09:59:00.000Z"}, "incompatible"),
        ({"direction": "debit"}, "incoming"),
        ({"status": "pending"}, "completed"),
        ({"amount": "101"}, "remaining"),
        ({"amount": "0"}, "zero"),
    ],
)
def test_unresolved_adjustments_never_reduce_known_spending(history, changes, expected):
    store, dataset = history
    commit(
        store,
        dataset,
        row("purchase", "unspecified"),
        {
            **row("refund", "refund", amount="10", direction="credit", related_event_id="purchase"),
            **changes,
        },
    )
    result = store.assess(dataset, 1)
    refund = next(item for item in result.lifecycle.entries if item.source_event_id == "refund")
    assert refund.resolution == "unresolved"
    assert expected in refund.reason
    assert refund.refunded_minor == 0
    assert sum(item.net_outflow_minor for item in result.lifecycle.currencies) == 10000


def test_multiple_refunds_cannot_exceed_capture_and_currencies_never_mix(history):
    store, dataset = history
    commit(
        store,
        dataset,
        row("purchase", "unspecified"),
        row("refund-1", "refund", direction="credit", related_event_id="purchase", amount="70"),
        row(
            "refund-2",
            "refund",
            direction="credit",
            related_event_id="purchase",
            amount="40",
            timestamp="2026-10-01T10:01:00.000Z",
            source_available_at="2026-10-01T10:01:00.000Z",
        ),
        row(
            "eur",
            "unspecified",
            currency="EUR",
            underlying_transaction_id="eur-purchase",
            amount="80",
        ),
    )
    result = store.assess(dataset, 1)
    by_currency = {item.currency: item for item in result.lifecycle.currencies}
    assert by_currency["USD"].net_outflow_minor == 3000
    assert by_currency["USD"].unresolved_count == 1
    assert by_currency["EUR"].net_outflow_minor == 8000
    assert next(item for item in result.assessments if item.source_event_id == "eur").score is None


def test_ambiguous_legacy_linkage_is_not_two_purchases_or_attempts(history):
    store, dataset = history
    commit(store, dataset, row("one", "unspecified"), row("two", "unspecified"))
    result = store.assess(dataset, 1)
    assert result.simulation is None
    assert result.lifecycle.currencies[0].unresolved_count == 2
    assert result.lifecycle.currencies[0].attempt_count == 0
    assert result.lifecycle.currencies[0].settled_minor == 0
    assert all(item.reason and "ambiguous" in item.reason for item in result.assessments)


def test_explicit_event_mapping_preserves_legacy_identity_defaults(history):
    store, dataset = history
    request = upload(
        row("one", transaction_id="same"),
        row("two", transaction_id="same", status="declined"),
    )
    original = store.preview(dataset, request)
    assert original.mapping["source_event_id"] == "transaction_id"
    assert not original.can_commit
    mapped = store.preview(
        dataset,
        request.model_copy(
            update={"options": ImportOptions(columns={"source_event_id": "event_id"})}
        ),
    )
    assert mapped.can_commit
    store.commit(dataset, mapped.id)
    assert store.dataset(dataset).event_count == 2
    assert store.assess(dataset, 1).lifecycle.currencies[0].attempt_count == 2


def test_split_reordered_lifecycle_and_late_links_equal_complete_history(history):
    store, dataset = history
    other = store.create(DatasetCreate(name="Split", source_namespace="bank")).id
    records = [
        row("auth"),
        row("capture", "capture", related_event_id="auth"),
        row("refund", "refund", direction="credit", amount="30", related_event_id="capture"),
    ]
    commit(store, dataset, *records)
    commit(store, other, records[2])
    before = store.assess(other, 1)
    assert before.lifecycle.currencies[0].unresolved_count == 1
    commit(store, other, *reversed(records))
    complete, split = store.assess(dataset, 1), store.assess(other, 2)
    assert split.analysis_hash == complete.analysis_hash
    assert split.lifecycle == complete.lifecycle
    assert store.run(other, before.id) == before


def test_correction_is_reviewed_append_only_and_idempotent_after_restart(history):
    store, dataset = history
    commit(store, dataset, row("purchase", "unspecified"))
    original = store.assess(dataset, 1)
    candidate = correction(
        store,
        dataset,
        row("purchase", "unspecified", amount="80", source_available_at="2026-10-02T10:00:00.000Z"),
    )
    assert candidate.rows[0].disposition == "corrected"
    change = next(item for item in candidate.rows[0].changes if item.field == "amount_minor")
    assert (change.before, change.after) == ("10000", "8000")
    assert store.snapshot(dataset)[1][0].amount_minor == 10000
    store.commit(dataset, candidate.id)
    reopened = HistoryStore(store.path)
    assert reopened.commit(dataset, candidate.id).committed_revision == 2
    assert reopened.dataset(dataset).event_count == 1
    assert reopened.snapshot(dataset, 1)[1][0].amount_minor == 10000
    assert reopened.snapshot(dataset, 2)[1][0].amount_minor == 8000
    assert reopened.run(dataset, original.id) == original
    event_id = candidate.rows[0].event_id
    versions = reopened.events(dataset, 2, 0, 50, event_id)
    assert [item.event.amount_minor for item in versions.items] == [10000, 8000]
    assert all(item.analytical_status == "not_assessed" for item in versions.items)
    assert all("Historical version" in item.reason for item in versions.items)
    assert [item.correction_reason for item in versions.items] == [
        None,
        "Provider corrected the source record",
    ]
    current = reopened.events(dataset, 2, 0, 50)
    assert current.total == 1
    assert [item.event.amount_minor for item in current.items] == [8000]
    assert current.items[0].accepted_revision == 2
    assert current.items[0].analytical_status == "eligible"
    assert [item.event.amount_minor for item in reopened.events(dataset, 1, 0, 50).items] == [10000]
    assert reopened.assess(dataset, 2).lifecycle.currencies[0].settled_minor == 8000


def test_cutoff_excludes_future_corrections_captures_and_late_source_records(history):
    store, dataset = history
    cutoff = "2026-10-01T10:05:00.000Z"
    commit(store, dataset, row("purchase", "unspecified"))
    original = store.assess(dataset, 1, "as_known", cutoff)
    candidate = correction(
        store,
        dataset,
        row("purchase", "unspecified", amount="80", source_available_at="2026-10-02T10:00:00.000Z"),
    )
    store.commit(dataset, candidate.id)
    commit(
        store,
        dataset,
        row(
            "late",
            underlying_transaction_id="another",
            source_available_at="2026-10-02T10:00:00.000Z",
        ),
    )
    historical = store.assess(dataset, 3, "as_known", cutoff)
    assert historical.assessments == original.assessments
    assert historical.analysis_hash == original.analysis_hash
    assert historical.lifecycle == original.lifecycle
    later = store.assess(dataset, 3, "as_known", "2026-10-03T10:00:00.000Z")
    assert len(later.assessments) == 2
    assert later.lifecycle.currencies[0].settled_minor == 8000
    assert later.analysis_hash != historical.analysis_hash
    assert store.run(dataset, original.id) == original


@pytest.mark.parametrize(
    "changes",
    [
        {"source_available_at": ""},
        {"timestamp": "2026-10-01"},
        {"source_available_at": "2026-09-30T00:00:00.000Z"},
    ],
)
def test_as_known_rejects_missing_or_impossible_provenance(history, changes):
    store, dataset = history
    commit(store, dataset, row("event", **changes))
    assert len(store.assess(dataset, 1).assessments) == 1
    with pytest.raises(ValueError, match="availability"):
        store.assess(dataset, 1, "as_known", "2026-10-02T00:00:00.000Z")


def test_correction_provenance_staleness_and_atomic_rollback(history):
    store, dataset = history
    commit(store, dataset, row("one"), row("two"))
    invalid = correction(store, dataset, row("one", amount="80"))
    assert not invalid.can_commit
    assert "later" in invalid.rows[0].reason
    changed = row("one", amount="80", source_available_at="2026-10-02T00:00:00.000Z")
    candidate = correction(store, dataset, changed, row("new"))
    with store.connection() as connection:
        connection.execute(
            "CREATE TRIGGER reject_new BEFORE INSERT ON events WHEN NEW.source_row=3 "
            "BEGIN SELECT RAISE(ABORT, 'failure'); END"
        )
    with pytest.raises(sqlite3.IntegrityError):
        store.commit(dataset, candidate.id)
    assert store.dataset(dataset).revision == 1
    assert {event.amount_minor for event in store.snapshot(dataset)[1]} == {10000}
    with store.connection() as connection:
        connection.execute("DROP TRIGGER reject_new")
    commit(store, dataset, row("separate"))
    with pytest.raises(HistoryConflict, match="changed"):
        store.commit(dataset, candidate.id)


def test_migration_preserves_v1_payload_hash_and_saved_assessment(history):
    store, dataset = history
    commit(store, dataset, row("original", "unspecified", related_event_id=""))
    golden = json.loads(
        (
            Path(__file__).resolve().parents[2] / "fixtures/evaluations/simulator-v2/burst-run.json"
        ).read_text()
    )
    with store.connection() as connection:
        payload = json.loads(connection.execute("SELECT payload_json FROM events").fetchone()[0])
        payload.pop("lifecycle_kind")
        payload.pop("related_event_id")
        payload.pop("device_trust_state")
        payload.pop("device_trust_effective_at")
        payload.pop("device_trust_provenance")
        digest = canonical_hash(
            {key: value for key, value in payload.items() if key != "source_fields"}
        )
        connection.execute(
            "UPDATE events SET payload_json=?, payload_hash=?", (json.dumps(payload), digest)
        )
        connection.executescript("""
            CREATE TABLE old_events (
                dataset_id TEXT NOT NULL REFERENCES datasets(id), id TEXT NOT NULL,
                payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
                accepted_revision INTEGER NOT NULL, recorded_at TEXT NOT NULL,
                import_id TEXT NOT NULL REFERENCES imports(id), source_row INTEGER NOT NULL,
                PRIMARY KEY(dataset_id,id)
            );
            INSERT INTO old_events SELECT dataset_id,id,payload_json,payload_hash,
                accepted_revision,recorded_at,import_id,source_row FROM events;
            DROP TABLE events;
            ALTER TABLE old_events RENAME TO events;
            ALTER TABLE imports DROP COLUMN correction_reason;
            ALTER TABLE imports DROP COLUMN normalizer_version;
            PRAGMA user_version=1;
        """)
        connection.execute(
            "INSERT INTO runs VALUES(?,?,?,?,?,?,?)",
            (
                dataset,
                golden["id"],
                1,
                golden["recordedAt"],
                8,
                golden["analysisHash"],
                json.dumps(golden),
            ),
        )
    migrated = HistoryStore(store.path)
    assert migrated.snapshot(dataset)[1][0].amount_minor == 10000
    assert migrated.run(dataset, golden["id"]).assessment_version == "assessment-v2.1"
    with migrated.connection() as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert (
            json.loads(connection.execute("SELECT payload_json FROM runs").fetchone()[0]) == golden
        )
    assert HistoryStore(store.path).dataset(dataset).revision == 1


def test_phase_two_api_corrections_versions_and_cutoff(tmp_path, monkeypatch):
    monkeypatch.setenv("RISKFLOW_DATA_DIR", str(tmp_path))
    client = TestClient(app)
    dataset = client.post(
        "/api/v2/datasets", json={"name": "Temporal", "sourceNamespace": "bank"}
    ).json()["id"]
    base = f"/api/v2/datasets/{dataset}"
    preview = client.post(
        base + "/imports/preview", json=upload(row("auth")).model_dump(by_alias=True)
    ).json()
    assert client.post(base + f"/imports/{preview['id']}/commit", json={}).status_code == 200
    changed = client.post(
        base + "/imports/preview",
        json=upload(
            row("auth", amount="90", source_available_at="2026-10-02T00:00:00.000Z")
        ).model_dump(by_alias=True),
    ).json()
    request = {
        "expectedRevision": 1,
        "eventIds": [changed["rows"][0]["eventId"]],
        "reason": "Corrected amount",
    }
    resolved = client.post(base + f"/imports/{changed['id']}/resolve", json=request)
    assert resolved.status_code == 200
    assert resolved.json()["canCommit"]
    assert (
        client.post(base + f"/imports/{resolved.json()['id']}/commit", json={}).status_code == 200
    )
    versions = client.get(base + f"/events/{request['eventIds'][0]}/versions?limit=1&offset=1")
    assert versions.json()["total"] == 2
    assert versions.json()["items"][0]["correctionReason"] == "Corrected amount"
    response = client.post(
        base + "/runs",
        json={"revision": 2, "mode": "as_known", "knowledgeCutoff": "2026-10-01T12:00:00.000Z"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["simulation"]["events"][0]["amountMinor"] == 10000
    assert response.json()["lifecycle"]["currencies"][0]["attemptCount"] == 1
    assert (
        client.post(
            base + "/runs", json={"revision": 2, "knowledgeCutoff": "2026-10-01T12:00:00.000Z"}
        ).status_code
        == 422
    )
    other = client.post(
        "/api/v2/datasets", json={"name": "Other", "sourceNamespace": "bank"}
    ).json()["id"]
    assert (
        client.get(f"/api/v2/datasets/{other}/events/{request['eventIds'][0]}/versions").status_code
        == 404
    )
    request["expectedRevision"] = 0
    assert (
        client.post(
            f"/api/v2/datasets/{other}/imports/{changed['id']}/resolve", json=request
        ).status_code
        == 404
    )


def test_concurrent_initialization_and_failed_migration_are_atomic(tmp_path):
    path = tmp_path / "concurrent.sqlite3"
    with ThreadPoolExecutor(max_workers=4) as pool:
        stores = list(pool.map(lambda _: HistoryStore(path), range(8)))
    assert len(stores) == 8
    with stores[0].connection() as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        connection.execute("PRAGMA user_version=1")
    with pytest.raises(sqlite3.OperationalError):
        HistoryStore(path)
    with stores[0].connection() as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
        assert (
            connection.execute(
                "SELECT count(*) FROM sqlite_master WHERE name='event_versions'"
            ).fetchone()[0]
            == 0
        )
        assert len(connection.execute("PRAGMA table_info(events)").fetchall()) == 9


def test_availability_cutoffs_separate_authorization_capture_and_adjustments(history):
    store, dataset = history
    commit(
        store,
        dataset,
        row("auth", status="pending"),
        row(
            "capture",
            "capture",
            related_event_id="auth",
            timestamp="2026-10-01T11:00:00.000Z",
            source_available_at="2026-10-01T11:00:00.000Z",
        ),
        row(
            "refund",
            "refund",
            direction="credit",
            amount="25",
            related_event_id="capture",
            timestamp="2026-10-01T12:00:00.000Z",
            source_available_at="2026-10-01T12:00:00.000Z",
        ),
    )
    expected = [("10", 1, 0), ("11", 2, 10000), ("12", 3, 7500)]
    for hour, count, net in expected:
        run = store.assess(dataset, 1, "as_known", f"2026-10-01T{hour}:00:00.000Z")
        assert len(run.assessments) == count
        assert run.lifecycle.currencies[0].attempt_count == 1
        assert run.lifecycle.currencies[0].net_outflow_minor == net
    empty = store.assess(dataset, 1, "as_known", "2026-10-01T09:59:59.999Z")
    assert empty.assessments == []
    assert empty.lifecycle.currencies == []


def test_partial_correction_review_accumulates_selections_and_old_previews_expire(history):
    store, dataset = history
    commit(store, dataset, row("one"), row("two"))
    changed = store.preview(
        dataset,
        upload(
            *[
                row(identifier, amount="80", source_available_at="2026-10-02T00:00:00.000Z")
                for identifier in ("one", "two")
            ]
        ),
    )
    first_id, second_id = [item.event_id for item in changed.rows]
    first = store.resolve(
        dataset,
        changed.id,
        CorrectionRequest(expected_revision=1, event_ids=[first_id], reason="Provider corrections"),
    )
    assert not first.can_commit
    second = store.resolve(
        dataset,
        first.id,
        CorrectionRequest(
            expected_revision=1, event_ids=[second_id], reason="Both records corrected by provider"
        ),
    )
    assert second.can_commit
    assert [item.disposition for item in second.rows] == ["corrected", "corrected"]
    store.commit(dataset, second.id)
    assert {event.amount_minor for event in store.snapshot(dataset)[1]} == {8000}
    pending = store.preview(dataset, upload(row("new")))
    with store.connection() as connection:
        connection.execute("UPDATE imports SET normalizer_version=1 WHERE id=?", (pending.id,))
    with pytest.raises(HistoryConflict, match="rules changed"):
        store.commit(dataset, pending.id)
    assert store.dataset(dataset).revision == 2
