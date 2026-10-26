import csv
from copy import deepcopy

from app.domain.model_inputs import feature_frame
from ml.artifacts import ROOT
from ml.features.geography import FEEDBACK_FEATURES
from ml.sample_inputs import payments


def test_upload_adapter_preserves_card_identity_and_excludes_outcomes():
    path = ROOT / "frontend/public/samples/ibm/short-history.csv"
    with path.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    baseline = payments(rows)
    changed = deepcopy(rows)
    for row in changed:
        row["Is Fraud?"] = "No" if row["Is Fraud?"] == "Yes" else "Yes"
    assert payments(changed) == baseline
    assert baseline[0].account_id == f"user-{rows[0]['User']}-card-{rows[0]['Card']}"
    current = feature_frame(baseline)
    assert not current[FEEDBACK_FEATURES].to_numpy().any()
    assert current.history_samples.iloc[0] == 0
    isolated = feature_frame([baseline[-1]])
    assert isolated.history_samples.iloc[0] == 0
    assert current.history_samples.iloc[-1] > 0
