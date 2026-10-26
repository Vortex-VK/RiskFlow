import base64
import csv
import io
import runpy
from pathlib import Path

from app.schemas.history import CorrectionRequest, DatasetCreate, ImportRequest
from app.storage.history import HistoryStore

ROOT = Path(__file__).resolve().parents[2]


def test_generated_source_preview_ledger_and_assessment_agree_on_missing_model_inputs(tmp_path):
    source = ROOT / "fixtures/evaluations/simulator-v2/riskflow_simulator_realistic_2400.csv"
    store = HistoryStore(tmp_path / "history.sqlite3")
    dataset = store.create(DatasetCreate(name="Generated source", source_namespace="generated")).id
    preview = store.preview(
        dataset,
        ImportRequest(
            filename=source.name,
            content_base64=base64.b64encode(source.read_bytes()).decode(),
        ),
    )
    assert preview.can_commit and len(preview.rows) == 2400
    assert all(row.analytical_status == "not_assessed" and row.reason for row in preview.rows)
    store.commit(dataset, preview.id)
    run = store.assess(dataset, 1)
    assert run.simulation is None
    assert all(row.coverage == "not_assessed" and row.model is None for row in run.assessments)
    page = store.events(dataset, 1, 0, 50)
    assert all(row.analytical_status == "not_assessed" for row in page.items)


def upload(rows):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return ImportRequest(
        filename="profiles.csv",
        content_base64=base64.b64encode(buffer.getvalue().encode()).decode(),
    )


def accept(store, dataset, rows):
    preview = store.preview(dataset, upload(rows))
    assert preview.can_commit, preview.errors
    store.commit(dataset, preview.id)


def test_model_replay_is_batch_duplicate_restart_and_cutoff_equivalent(tmp_path):
    with (ROOT / "fixtures/evaluations/simulator-v3/profiles.csv").open(newline="") as source:
        rows = list(csv.DictReader(source))
    for row in rows:
        row["source_available_at"] = row["timestamp"]
        row["channel"] = "Chip Transaction"
        row["merchant_category"] = "MCC 5411"
    store = HistoryStore(tmp_path / "history.sqlite3")
    first = store.create(DatasetCreate(name="Split", source_namespace="test")).id
    full = store.create(DatasetCreate(name="Full", source_namespace="test")).id
    accept(store, first, rows[:6])
    frozen = store.assess(first, 1)
    accept(store, first, rows[4:])
    accept(store, full, list(reversed(rows)))
    restarted = HistoryStore(store.path)
    split_result, full_result = restarted.assess(first, 2), restarted.assess(full, 1)
    assert split_result.profiles == full_result.profiles
    assert split_result.assessments == full_result.assessments
    assert split_result.analysis_hash == full_result.analysis_hash
    assert split_result.simulation.events[10].model.history_count == 10
    accept(restarted, first, rows)
    assert restarted.dataset(first).revision == 2
    assert restarted.run(first, frozen.id) == frozen
    changed = dict(rows[0], amount="500", source_available_at="2026-02-01T00:00:00.000Z")
    preview = restarted.preview(first, upload([changed]))
    corrected = restarted.resolve(
        first,
        preview.id,
        CorrectionRequest(
            expected_revision=2,
            event_ids=[preview.rows[0].event_id],
            reason="Source amount correction",
        ),
    )
    restarted.commit(first, corrected.id)
    original = restarted.assess(first, 2, "as_known", "2026-01-20T00:00:00.000Z")
    snapshot = restarted.assess(first, 3, "as_known", "2026-01-20T00:00:00.000Z")
    assert original.profiles == snapshot.profiles
    assert original.assessments == snapshot.assessments
    assert snapshot.simulation.events == original.simulation.events


def test_ibm_adapter_keeps_labels_separate_and_selection_and_identity_label_independent(tmp_path):
    prepare = runpy.run_path(str(ROOT / "scripts/prepare_ibm_data.py"))["prepare"]
    headers = [
        "User",
        "Card",
        "Year",
        "Month",
        "Day",
        "Time",
        "Amount",
        "Use Chip",
        "Merchant Name",
        "Merchant City",
        "Merchant State",
        "Zip",
        "MCC",
        "Errors?",
        "Is Fraud?",
    ]
    rows = [
        [
            str(user),
            "0",
            "2018",
            "1",
            "1",
            "12:00",
            "$10.00",
            "Swipe Transaction",
            "M",
            "City",
            "CA",
            "12345",
            "5411",
            "",
            label,
        ]
        for user, label in ((0, "Yes"), (1, "No"))
    ]
    source = tmp_path / "ibm.csv"

    def write(values):
        with source.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.writer(stream)
            writer.writerow(headers)
            writer.writerows(values)

    write(rows)
    manifest = prepare(source, tmp_path / "one", "2018-01-01", "2018-07-01", 1)
    rows[0][-1], rows[1][-1] = "No", "Yes"
    write(list(reversed(rows)))
    prepare(source, tmp_path / "two", "2018-01-01", "2018-07-01", 1)
    assert manifest["scanned_rows"] == 2
    for group in ("development", "holdout"):
        a = (tmp_path / "one" / f"{group}.csv").read_bytes()
        b = (tmp_path / "two" / f"{group}.csv").read_bytes()
        assert a == b
        assert b"Is Fraud?" not in a and b"device_id" not in a
        assert (tmp_path / "one" / f"{group}-labels.csv").read_bytes() != (
            tmp_path / "two" / f"{group}-labels.csv"
        ).read_bytes()
