from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from ml import stack_comparison
from ml.features.stack import compatibility
from ml.stack_runtime import runtime


@pytest.mark.parametrize("method", ["single", "comparison"])
def test_explanations_build_history_once_and_refresh_it_for_each_request(method):
    root = Path(__file__).resolve().parents[2] / "fixtures/runtime/stack-d5"
    original = pd.read_csv(root / "new_customers.csv", dtype=str, keep_default_na=False)
    changed = original.copy()
    # Keep the same IDs and row count: reusing an earlier request would be stale.
    changed["amount"] = "1"
    changed.loc[len(changed) - 1, "amount"] = "900000"
    engine = runtime()
    expected = [engine.predict(frame)[1]["stack_d5"] for frame in [original, changed]]
    assert expected[0][-1] != expected[1][-1]

    with patch.object(compatibility, "legacy_build", wraps=compatibility.legacy_build) as build:
        for request_index, frame in enumerate([original, changed, original]):
            selected, reference = len(frame) - 1, 0
            scores = expected[1 if request_index == 1 else 0]
            if method == "single":
                normalized, _, contributions, raw, _ = engine.explain(frame, selected)
                assert raw == scores[selected]
                assert contributions.sum() == pytest.approx(raw, abs=1e-7)
                assert normalized.amount.iloc[-1] == float(frame.amount.iloc[-1])
            else:
                raw, middle, _ = stack_comparison.compare_checks(frame, selected, reference)
                assert raw == scores[selected]
                assert middle == scores[reference]
            assert build.call_count == request_index + 1


def test_invalid_request_does_not_poison_later_explanations():
    from ml.common import ModelUnavailable

    root = Path(__file__).resolve().parents[2] / "fixtures/runtime/stack-d5"
    data = pd.read_csv(root / "date_only.csv", dtype=str, keep_default_na=False)
    engine = runtime()
    expected = engine.explain(data, len(data) - 1)[3]
    invalid = data.copy()
    invalid.loc[0, "currency"] = "EUR"
    with pytest.raises(ModelUnavailable):
        engine.explain(invalid, len(invalid) - 1)
    assert engine.explain(data, len(data) - 1)[3] == expected
