import json
import shutil

import numpy as np
import pandas as pd
import pytest

from ml.artifacts import ROOT, digest
from ml.coverage_runtime import BUNDLE, MANIFEST_SHA256, Runtime, runtime
from ml.features.upload_context import feature_frame
from ml.runtime import ModelUnavailable
from ml.sample_inputs import payments


@pytest.mark.parametrize(
    "name",
    [
        "first-five",
        "short-history",
        "online-episode",
        "mixed-channels",
        "many-accounts",
        "full-workspace",
    ],
)
def test_packaged_coverage_matches_every_frozen_sample_decision(name):
    rows = pd.read_csv(
        ROOT / f"frontend/public/samples/ibm/{name}.csv", dtype=str, keep_default_na=False
    ).to_dict("records")
    frame = feature_frame(payments(rows))
    scores, paths = runtime().predict(frame)
    receipt = json.loads((ROOT / "fixtures/model/coverage-samples.json").read_text())["samples"][
        name
    ]
    assert len(frame) == receipt["rows"]
    np.testing.assert_array_equal(paths["alert"], frame.id.isin(receipt["alert_ids"]))
    assert set(scores) == {
        "baseline",
        "cb",
        "online_cb",
        "online_ebm",
        "depth6",
        "base_margin",
        "coverage",
    }
    assert not paths["coverage"][frame.channel.eq("Online Transaction")].any()
    assert not paths["retained_online"][frame.channel.ne("Online Transaction")].any()


def test_coverage_package_rejects_missing_corrupt_and_changed_manifests(tmp_path):
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_bytes((BUNDLE / "manifest.json").read_bytes())
    manifest = json.loads((BUNDLE / "manifest.json").read_text())
    for entry in [*manifest["teachers"].values(), *manifest["models"]]:
        shutil.copyfile(BUNDLE / entry["file"], tmp_path / entry["file"])
    (tmp_path / manifest["models"][0]["file"]).write_bytes(b"corrupt")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    assert digest(BUNDLE / "manifest.json") == MANIFEST_SHA256
