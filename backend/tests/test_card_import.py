import base64

import pytest

from app.domain.ingestion import normalize_row, read_import
from app.domain.model_inputs import feature_frame, source_input
from app.domain.projections import project_history
from app.schemas.history import Dataset, ImportOptions, ImportRequest

HEADER = (
    "User,Card,Year,Month,Day,Time,Amount,Use Chip,Merchant Name,"
    "Merchant City,Merchant State,Zip,MCC,Errors?"
)
ROW = "1,0,2018,1,2,08:04,$37.66,Chip Transaction,-123,Boston,MA,02108,5912,"


def read(text, offset=None):
    return read_import(
        ImportRequest(
            filename="card.csv",
            content_base64=base64.b64encode(text.encode()).decode(),
            options=ImportOptions(utc_offset_minutes=offset),
        ),
        "card-test",
    )


def test_native_card_import_scopes_history_and_preserves_status_time_and_zip():
    _, mapping, incoming, invalid = read(f"{HEADER}\n{ROW}\n{ROW.replace('1,0,', '1,1,')}Bad PIN")
    assert not invalid and len(incoming) == 2
    first, second = (event for _, event in incoming)
    assert mapping["merchant_id"] == "Merchant Name"
    assert first.account_id == "ibm-user-1-card-0"
    assert second.account_id == "ibm-user-1-card-1"
    assert first.occurred_at == "2018-01-02T08:04:00.000Z"
    assert first.status == "completed" and second.status == "failed"
    assert source_input(first).merchant_zip == "02108"
    _, _, shifted, invalid = read(f"{HEADER}\n{ROW}", -300)
    assert not invalid and shifted[0][1].occurred_at == "2018-01-02T13:04:00.000Z"


def test_card_labels_never_change_identity_or_features_and_repeated_rows_stay_distinct():
    frames = []
    ids = []
    dataset = Dataset(
        id="test",
        name="Card test",
        source_namespace="card-test",
        revision=1,
        event_count=2,
        created_at="2026-01-01T00:00:00.000Z",
    )
    for label in ("Yes", "No"):
        _, _, incoming, invalid = read(f"{HEADER},Is Fraud?\n{ROW},{label}\n{ROW},{label}")
        assert not invalid
        events = [event for _, event in incoming]
        ids.append([event.id for event in events])
        frames.append(
            feature_frame(project_history(dataset, events, model_only=True).scenario.payments)
        )
    assert ids[0] == ids[1] and len(set(ids[0])) == 2
    assert frames[0].equals(frames[1])
    assert frames[0]["history_samples"].tolist() == [0, 0]


def test_card_negative_amount_is_retained_as_unscored_incoming_adjustment():
    _, _, incoming, invalid = read(f"{HEADER}\n{ROW.replace('$37.66', '$-10.00')}")
    assert not invalid
    event = incoming[0][1]
    assert event.direction == "credit" and event.activity_type == "credit_adjustment"
    assert event.amount_minor == -1000


def test_generic_split_dates_validate_calendar_and_require_explicit_timezone():
    fields = {
        "source_event_id": "one",
        "account_id": "a",
        "year": "2024",
        "month": "2",
        "day": "29",
        "time": "08:04",
        "amount": "10",
        "currency": "USD",
    }
    with pytest.raises(ValueError, match="timezone"):
        normalize_row(fields, "test", ImportOptions())
    valid = normalize_row(fields, "test", ImportOptions(utc_offset_minutes=-300))
    assert valid.occurred_at == "2024-02-29T13:04:00.000Z"
    with pytest.raises(ValueError):
        normalize_row({**fields, "year": "2023"}, "test", ImportOptions(utc_offset_minutes=0))
    with pytest.raises(ValueError, match="calendar components"):
        normalize_row({**fields, "month": ""}, "test", ImportOptions())
