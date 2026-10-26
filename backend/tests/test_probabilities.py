import math
from pathlib import Path

import numpy as np
import pytest

from app.domain.model_scores import probability_score
from ml.artifacts import digest
from ml.probability_math import predict
from ml.probability_runtime import BUNDLE, MANIFEST_SHA256, Runtime, runtime
from ml.runtime import ModelUnavailable


def test_probability_package_is_trained_monotone_and_preserves_reference_boundaries():
    assert digest(BUNDLE / "manifest.json") == MANIFEST_SHA256
    for source, mapping in runtime().manifest["sources"].items():
        cutoff = mapping["raw_cutoff"]
        values = [probability_score(cutoff + d, cutoff, source) for d in (-1000, -1, 0, 1, 1000)]
        assert [v.value for v in values] == sorted(v.value for v in values)
        assert values[2].value == pytest.approx(values[2].reference_value, abs=1e-12)
        assert values[2].reference_value != 50
        for value in values:
            assert value.probability_available and value.version == "fraud-probability-v1"
            assert 0 < value.value < 100
            assert value.probability_bundle_sha256 == MANIFEST_SHA256
            assert value.calibration_scope == "ibm_synthetic"
        assert values[1].value < values[1].reference_value < values[3].value
        with pytest.raises(ValueError):
            probability_score(0, cutoff + 1, source)


def test_probability_loader_rejects_missing_corrupt_or_nonfinite_outputs(tmp_path: Path):
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(ModelUnavailable):
        Runtime(tmp_path)
    for x in (math.inf, -math.inf, math.nan):
        with pytest.raises(ModelUnavailable):
            runtime().probability(x, "coverage")
    with pytest.raises(ModelUnavailable):
        runtime().probability(0, "unknown")


def test_probability_mapping_math():
    np.testing.assert_allclose(
        predict({"method": "sigmoid", "slope": 2, "intercept": -1}, [0, 0.5, 1]),
        [1 / (1 + math.exp(1)), 0.5, 1 / (1 + math.exp(-1))],
    )
    np.testing.assert_allclose(
        predict({"method": "isotonic", "x": [0, 1], "y": [0.1, 0.9]}, [-1, 0.5, 2]), [0.1, 0.5, 0.9]
    )
