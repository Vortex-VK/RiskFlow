# Reproduction

Use the existing project Python and ML dependencies from the workspace root:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe scripts/audit_ml_v7_source.py
backend/.venv/Scripts/python.exe scripts/verify_ml_v8.py
backend/.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests
backend/.venv/Scripts/mypy.exe --config-file backend/pyproject.toml backend/ml_v7 backend/ml_v8
backend/.venv/Scripts/ruff.exe check backend/ml_v7 backend/ml_v8 backend/tests/test_ml_v7.py backend/tests/test_ml_v8.py
```

Exact replay checks all calibration and evaluation scores, fixed thresholds, predictions, metrics and paired intervals against saved model packages and hash-checked materialized features. It also checks numerical health. It does not perform a second training rebuild or re-extract the entire source. The independent source audit validates all 36 role/half-year/channel coverage groups against the original CSV.

A clean rebuild requires the immutable v4 caches, the completed v7 geography/feedback caches, and the unaffected v7 2016 CatBoost packages and mining identity record. In a separate workspace with no existing v8 outputs:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe -m ml_v8.pipeline run
backend/.venv/Scripts/python.exe -m ml_v8.pipeline report
backend/.venv/Scripts/python.exe -m ml_v8.pipeline full
backend/.venv/Scripts/python.exe scripts/probe_ml_v8.py
backend/.venv/Scripts/python.exe scripts/verify_ml_v8.py
backend/.venv/Scripts/python.exe scripts/report_ml_v8.py
```

The reused CatBoost packages are checked against their original hashes, fitting IDs, labels, inclusion weights and configuration. This avoids repeating unaffected expensive fits. All new EBM models and miners use the repaired factory. Reproduction dependencies are local research artifacts under ignored `training_data/`, not a public redistributable inference package.

Existing model/fold outputs are not overwritten. Do not delete historical runs to force a rebuild. The full-data latest-fold result and online/latency probes use already consumed historical evaluation data and remain descriptive. The application still runs its existing rules; no model was activated.
