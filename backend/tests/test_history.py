import base64
import csv
import hashlib
import io
import json
import sqlite3
from collections import Counter
from pathlib import Path

import pytest

from app.domain.ingestion import normalize_row, parse_money
from app.schemas.history import DatasetCreate, ImportOptions, ImportRequest
from app.storage.history import HistoryConflict, HistoryStore

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures/evaluations/simulator-v2"


def test_supplied_reference_sources_match_recorded_hashes() -> None:
    expected = json.loads((FIXTURES / "expected.json").read_text())
    for name, digest in expected["sourceHashes"].items():
        assert hashlib.sha256((FIXTURES / name).read_bytes()).hexdigest() == digest


def upload(name: str) -> ImportRequest:
    return ImportRequest(
        filename=name,
        content_base64=base64.b64encode((FIXTURES / name).read_bytes()).decode(),
    )


def edited_upload(**changes: str) -> ImportRequest:
    rows = list(csv.DictReader((FIXTURES / "burst.csv").read_text().splitlines()))
    row = {**rows[0], **changes}
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(row))
    writer.writeheader()
    writer.writerow(row)
    return ImportRequest(
        filename="edited.csv",
        content_base64=base64.b64encode(
            output.getvalue().encode(),
        ).decode(),
    )


@pytest.fixture
def store(tmp_path: Path) -> HistoryStore:
    return HistoryStore(tmp_path / "history.sqlite3")


def create(store: HistoryStore, namespace: str = "test-bank") -> str:
    return store.create(DatasetCreate(name="Test history", source_namespace=namespace)).id


def commit(store: HistoryStore, dataset: str, request: ImportRequest) -> None:
    preview = store.preview(dataset, request)
    assert preview.can_commit, (preview.errors, preview.rows)
    store.commit(dataset, preview.id)


def test_legacy_import_without_model_inputs_is_retained_without_invented_scores(
    store: HistoryStore,
) -> None:
    dataset = create(store)
    preview = store.preview(dataset, upload("riskflow_simulator_realistic_2400.csv"))
    assert preview.can_commit, preview.errors
    assert len(preview.rows) == 2400
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    assert run.simulation is None
    assert len(run.assessments) == 2400
    assert all(
        item.coverage == "not_assessed" and item.model is None and item.reason
        for item in run.assessments
    )
    assert store.events(dataset, None, 0, 1).total == 2400


def test_overlap_restart_duplicate_and_full_batch_equivalence(store: HistoryStore) -> None:
    split = create(store)
    full = create(store)
    commit(store, split, upload("burst-first.csv"))
    frozen = store.assess(split, 1)
    assert [item.score for item in frozen.assessments] == [None] * 4
    preview = store.preview(split, upload("burst-overlap.csv"))
    assert Counter(row.disposition for row in preview.rows) == {"added": 4, "duplicate": 2}
    store.commit(split, preview.id)
    assert store.commit(split, preview.id).committed_revision == 2
    reopened = HistoryStore(store.path)
    commit(reopened, full, upload("burst.csv"))
    first = reopened.assess(split, 2)
    second = reopened.assess(full, 1)
    assert [item.score for item in first.assessments] == [None] * 8
    assert first.assessments == second.assessments
    assert first.analysis_hash == second.analysis_hash
    assert reopened.run(split, frozen.id) == frozen
    duplicate = reopened.preview(split, upload("burst.csv"))
    assert {row.disposition for row in duplicate.rows} == {"duplicate"}
    assert reopened.commit(split, duplicate.id).committed_revision == 2
    assert reopened.dataset(split).event_count == 8
    assert reopened.snapshot(split, 1)[0].event_count == 4


def test_conflicts_missing_ids_and_stale_previews_are_atomic(store: HistoryStore) -> None:
    dataset = create(store)
    stale = store.preview(dataset, upload("burst-overlap.csv"))
    commit(store, dataset, upload("burst-first.csv"))
    with pytest.raises(HistoryConflict, match="changed since preview"):
        store.commit(dataset, stale.id)
    conflict = store.preview(dataset, edited_upload(amount="999.99"))
    assert conflict.rows[0].disposition == "conflict"
    assert not conflict.can_commit
    with pytest.raises(HistoryConflict, match="Nothing was committed"):
        store.commit(dataset, conflict.id)
    missing = store.preview(dataset, edited_upload(transaction_id=""))
    assert missing.rows[0].disposition == "invalid"
    assert not missing.can_commit
    assert store.dataset(dataset).event_count == 4


def test_distinct_identical_purchases_and_source_account_scope(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload())
    commit(store, dataset, edited_upload(transaction_id="different-id"))
    commit(store, dataset, edited_upload(account_id="another-account"))
    assert store.dataset(dataset).event_count == 3
    other = create(store, "another-bank")
    commit(store, other, edited_upload())
    assert store.snapshot(other)[1][0].id not in {event.id for event in store.snapshot(dataset)[1]}
    with pytest.raises(KeyError):
        store.run(other, store.assess(dataset, 3).id)
    preview = store.preview(dataset, edited_upload())
    with pytest.raises(KeyError):
        store.commit(other, preview.id)


def test_late_history_changes_new_run_but_not_old_run(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, upload("burst-overlap.csv"))
    before = store.assess(dataset, 1)
    commit(store, dataset, upload("burst-first.csv"))
    after = store.assess(dataset, 2)
    full = create(store)
    commit(store, full, upload("burst.csv"))
    assert after.assessments == store.assess(full, 1).assessments
    assert before.analysis_hash != after.analysis_hash
    assert store.run(dataset, before.id) == before


@pytest.mark.parametrize("activity", ["refund", "transfer_in", "transfer_out", "cash_withdrawal"])
def test_unsupported_activity_is_retained_without_a_score(
    store: HistoryStore, activity: str
) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload(transaction_type=activity))
    run = store.assess(dataset, 1)
    assert run.simulation is None
    assert run.assessments[0].score is None
    assert run.assessments[0].recommendation == "not_assessed"
    assert store.events(dataset, None, 0, 10).items[0].event.activity_type == activity


def test_missing_context_and_date_precision_disable_only_applicable_signals(
    store: HistoryStore,
) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload(device_id="", timestamp="2026-10-08"))
    run = store.assess(dataset, 1)
    assert run.assessments[0].score is None
    assert run.assessments[0].evaluated_rules == 0
    second = create(store)
    commit(store, second, edited_upload(device_id=""))
    assessed = store.assess(second, 1).assessments[0]
    assert assessed.score is None
    assert assessed.coverage == "not_assessed"
    assert assessed.evaluated_rules == 0
    assert assessed.recommendation == "not_assessed"


def test_row_order_and_timestamp_format_do_not_change_identity(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload())
    duplicate = store.preview(dataset, edited_upload(timestamp="2026-10-08T15:08:11-04:00"))
    assert duplicate.rows[0].disposition == "duplicate"
    request = upload("burst.csv")
    lines = base64.b64decode(request.content_base64).decode().splitlines()
    reordered = request.model_copy(
        update={
            "content_base64": base64.b64encode(
                (lines[0] + "\n" + "\n".join(reversed(lines[1:]))).encode(),
            ).decode()
        }
    )
    second = create(store)
    commit(store, second, reordered)
    commit(store, dataset, request)
    assert store.assess(second, 1).analysis_hash == store.assess(dataset, 2).analysis_hash


def test_timezone_must_be_explicit_for_naive_instants(store: HistoryStore) -> None:
    dataset = create(store)
    request = edited_upload(timestamp="2026-10-08T15:08:11")
    assert not store.preview(dataset, request).can_commit
    request = request.model_copy(update={"options": ImportOptions(utc_offset_minutes=-240)})
    commit(store, dataset, request)
    assert store.snapshot(dataset)[1][0].occurred_at == "2026-10-08T19:08:11.000Z"


@pytest.mark.parametrize(
    "amount,separator,expected",
    [
        ("$1,234.56", ".", 123456),
        ("(USD 1,234.56)", ".", -123456),
        ("1.234,56", ",", 123456),
        ("-0.01", ".", -1),
    ],
)
def test_money_parsing_preserves_minor_units(amount: str, separator: str, expected: int) -> None:
    assert parse_money(amount, separator) == expected


@pytest.mark.parametrize("amount", ["1.001", "NaN", "1e3", "1,23.45", "--10", "Infinity"])
def test_invalid_money_is_not_rounded_or_inferred(amount: str) -> None:
    with pytest.raises(ValueError):
        parse_money(amount, ".")


def test_utf16_semicolon_mapping_and_local_dates(store: HistoryStore) -> None:
    dataset = create(store)
    content = "id;account_id;when;amount;currency;transaction_type;direction;status;merchant_name\n"
    content += 'one;account;21/10/2026 12:00:00;"1.234,56";EUR;purchase;debit;completed;Shop\n'
    request = ImportRequest(
        filename="local.csv",
        content_base64=base64.b64encode(content.encode("utf-16")).decode(),
        options=ImportOptions(
            columns={"occurred_at": "when"},
            delimiter=";",
            decimal_separator=",",
            date_order="dmy",
            utc_offset_minutes=120,
        ),
    )
    commit(store, dataset, request)
    event = store.snapshot(dataset)[1][0]
    assert event.amount_minor == 123456
    assert event.occurred_at == "2026-10-21T10:00:00.000Z"
    assert event.currency == "EUR"
    assert store.assess(dataset, 1).assessments[0].score is None


def test_commit_rolls_back_every_record_and_revision_on_database_failure(
    store: HistoryStore,
) -> None:
    dataset = create(store)
    preview = store.preview(dataset, upload("burst.csv"))
    with store.connection() as connection:
        connection.execute("""CREATE TRIGGER reject_second BEFORE INSERT ON events
            WHEN NEW.source_row = 3 BEGIN SELECT RAISE(ABORT, 'injected failure'); END""")
    with pytest.raises(sqlite3.IntegrityError, match="injected failure"):
        store.commit(dataset, preview.id)
    assert store.dataset(dataset).revision == 0
    assert store.dataset(dataset).event_count == 0
    with store.connection() as connection:
        connection.execute("DROP TRIGGER reject_second")
    assert store.commit(dataset, preview.id).committed_revision == 1
    assert store.dataset(dataset).event_count == 8


def test_projection_overflow_preserves_previous_accepted_history(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload())
    rows = list(csv.DictReader((FIXTURES / "burst.csv").read_text().splitlines()))
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    for index in range(10001):
        writer.writerow({**rows[0], "transaction_id": f"overflow-{index}"})
    request = ImportRequest(
        filename="overflow.csv",
        content_base64=base64.b64encode(output.getvalue().encode()).decode(),
    )
    preview = store.preview(dataset, request)
    assert not preview.can_commit
    assert any("10000" in error for error in preview.errors)
    with pytest.raises(HistoryConflict):
        store.commit(dataset, preview.id)
    assert store.dataset(dataset).event_count == 1
    assert store.dataset(dataset).revision == 1


def test_unmapped_context_changes_are_conflicts_not_silent_duplicates(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload())
    preview = store.preview(dataset, edited_upload(channel="changed-channel"))
    assert preview.rows[0].disposition == "conflict"
    assert not preview.can_commit


def test_future_transactions_do_not_enter_an_earlier_window(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, upload("burst.csv"))
    first = store.assess(dataset, 1)
    commit(store, dataset, edited_upload(transaction_id="future", timestamp="2026-10-09T19:08:11Z"))
    after = store.assess(dataset, 2)
    assert after.assessments[:-1] == first.assessments
    assert after.assessments[-1].model is None and after.assessments[-1].reason


def test_missing_type_direction_and_status_are_not_invented_purchases(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload(transaction_type="", direction="", status=""))
    assert store.assess(dataset, 1).assessments[0].recommendation == "not_assessed"
    assert store.snapshot(dataset)[1][0].status == ""


def test_same_time_order_is_independent_of_upload_order(store: HistoryStore) -> None:
    first = create(store)
    second = create(store)
    one = edited_upload(transaction_id="one")
    two = edited_upload(transaction_id="two", account_id="second-account")
    commit(store, first, one)
    commit(store, first, two)
    commit(store, second, two)
    commit(store, second, one)
    assert store.assess(first, 2).assessments == store.assess(second, 2).assessments


def test_unsupported_database_version_is_not_replaced(store: HistoryStore) -> None:
    with store.connection() as connection:
        connection.execute("PRAGMA user_version = 99")
    with pytest.raises(ValueError, match="different RiskFlow version"):
        HistoryStore(store.path)
    with store.connection() as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 99


def test_stored_content_mismatch_is_not_silently_assessed(store: HistoryStore) -> None:
    dataset = create(store)
    commit(store, dataset, edited_upload())
    with store.connection() as connection:
        connection.execute(
            "UPDATE events SET payload_hash='corrupt' WHERE dataset_id=?", (dataset,)
        )
    with pytest.raises(ValueError, match="recorded hash"):
        store.assess(dataset, 1)


def test_separate_date_time_and_debit_credit_preserve_explicit_source_values() -> None:
    fields = {
        "source_event_id": "one",
        "account_id": "account",
        "occurred_at": "2026-10-21",
        "time": "12:34:56Z",
        "debit": "12.34",
        "credit": "0",
        "currency": "USD",
    }
    event = normalize_row(fields, "bank", ImportOptions())
    assert event.occurred_at == "2026-10-21T12:34:56.000Z"
    assert event.time_precision == "instant"
    assert event.amount_minor == 1234
    assert event.direction == "debit"
    incoming = normalize_row({**fields, "debit": "0", "credit": "50"}, "bank", ImportOptions())
    assert incoming.amount_minor == 5000
    assert incoming.direction == "credit"
    with pytest.raises(ValueError, match="only one nonzero side"):
        normalize_row({**fields, "credit": "50"}, "bank", ImportOptions())
    with pytest.raises(ValueError, match="date-only"):
        normalize_row({**fields, "occurred_at": "2026-10-21T15:00:00Z"}, "bank", ImportOptions())
    with pytest.raises(ValueError, match="Direction conflicts"):
        normalize_row({**fields, "direction": "credit"}, "bank", ImportOptions())
    zero = normalize_row({**fields, "debit": "0"}, "bank", ImportOptions())
    assert zero.amount_minor == 0
    assert zero.direction == ""
