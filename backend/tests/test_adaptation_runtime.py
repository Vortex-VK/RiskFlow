import json

import numpy as np
import pandas as pd
import pytest

from ml.adaptation_runtime import BUNDLE, MANIFEST_SHA256, Runtime, runtime
from ml.artifacts import ROOT, digest
from ml.features.upload_context import feature_frame
from ml.runtime import ModelUnavailable
from ml.sample_inputs import payments


def test_installed_candidate_matches_frozen_customer_holdout():
    raw = pd.read_csv(
        ROOT / "fixtures/evaluations/card-format-10000/unlabeled.csv",
        dtype=str,
        keep_default_na=False,
    )
    frame = feature_frame(payments(raw.to_dict("records")))
    scores, paths = runtime().predict(frame)
    p = runtime().probability(scores["adapted_card"])
    saved = pd.DataFrame(
        json.loads((ROOT / "fixtures/model/authored-holdout.json").read_text())["records"]
    ).set_index("id")
    mask = frame.id.isin(saved.index)
    expected = saved.loc[frame.loc[mask, "id"]]
    np.testing.assert_array_equal(p[mask], expected.probability)
    np.testing.assert_array_equal(paths["alert"][mask], expected.probability >= expected.cutoff)
    assert int((paths["alert"][mask] & expected.label.to_numpy()).sum()) == 23
    assert int((paths["alert"][mask] & ~expected.label.to_numpy()).sum()) == 2
    changed = frame.copy()
    changed["label"] = True
    changed["scenario_type"] = "unavailable"
    other, flags = runtime().predict(changed)
    np.testing.assert_array_equal(other["adapted_card"], scores["adapted_card"])
    np.testing.assert_array_equal(flags["alert"], paths["alert"])
    short, _ = runtime().predict(frame.iloc[:500])
    np.testing.assert_array_equal(short["adapted_card"], scores["adapted_card"][:500])


def test_candidate_integrity_and_missing_score_fail_closed(monkeypatch):
    assert digest(BUNDLE / "manifest.json") == MANIFEST_SHA256
    manifest = json.loads((BUNDLE / "manifest.json").read_text())
    assert not manifest["statistical_promotion_gate_passed"]
    for bad in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(ModelUnavailable):
            runtime().probability([bad])
    monkeypatch.setattr(
        "ml.adaptation_runtime.digest", lambda p: "0" * 64 if p.suffix == ".cbm" else digest(p)
    )
    with pytest.raises(ModelUnavailable, match="package"):
        Runtime()
