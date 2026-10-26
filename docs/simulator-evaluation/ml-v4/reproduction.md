# Reproduce v4

Use the existing project-local Python 3.13 environment and optional ML dependencies. No dependency or application startup change is required. Original source and all v1–v3 artifacts remain unchanged.

From the repository root in PowerShell:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v4.py
```

The verifier checks prior v1–v3 frozen predictions and inputs, all v4 extraction/feature inputs, protocol, implementation and pilot prediction hashes. It recomputes pooled and quarterly screening metrics and nomination, reloads final models and checks every confirmation score for exact equality, then recomputes the frozen numerical report. Any mismatch fails instead of overwriting results. If no nominee qualified, it verifies that screening result and checks the label-access ledger without opening confirmation outcomes. Replaying consumed outcomes is not a new statistical evaluation.

A full new-directory rebuild is available with:

```powershell
backend/.venv/Scripts/python.exe scripts/run_ml_v4.py --name ml-v4-reproduction-01
```

Use an unused name. This repeats the original full source scan, all feature generation and fitting; expect substantial local CPU and disk work. It writes only to the new ignored `training_data/<name>/` directory. It reuses the immutable v2 feature definitions, not cached fitted models. The source SHA must match the IBM CSV. Changing the input file format is not supported by this source-specific experiment.

Original stages, from the backend directory, are `python -m ml_v4.prepare`, `python -m ml_v4.build`, and `python -m ml_v4.pipeline screen`, `finalize`, `score`, `report`. Frozen or incomplete outputs cannot be silently overwritten. Feature caches reconcile eligible row counts with extraction; labels remain in separate sidecars. The base feature cache omits rule-score computation because v4 does not evaluate rules; it preserves the actual v2 learned measurements. The new context cache is an indexed SQLite table built from a global chronological pass.

All positive training outcomes are retained. Negatives are selected by a fixed prefix of the event's content hash, independently of model predictions; exact duplicate occurrences share the hash and sampling decision. Selected negatives receive inverse inclusion weights. This is a bounded weighted fitting method, not an undersampled evaluation. Screening and confirmation keep every eligible transaction and the full 1% review budget. Histories are computed before sampling. Broader training is compared as a complete procedure, including its bounded sampler; a result cannot be attributed exclusively to calendar duration.

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -o addopts='' -q
backend/.venv/Scripts/python.exe -m mypy --config-file backend/pyproject.toml backend/app backend/ml backend/ml_v2 backend/ml_v3 backend/ml_v4
backend/.venv/Scripts/python.exe -m ruff check --config backend/pyproject.toml backend scripts/run_ml_v4.py scripts/verify_ml_v4.py scripts/diagnose_ml_v4.py scripts/check_ml_v4_features.py
backend/.venv/Scripts/python.exe -m ruff format --check --config backend/pyproject.toml backend scripts/run_ml_v4.py scripts/verify_ml_v4.py scripts/diagnose_ml_v4.py scripts/check_ml_v4_features.py
backend/.venv/Scripts/python.exe scripts/check_ml_v4_features.py
```

`scripts/diagnose_ml_v4.py` independently reproduces the aggregate diagnosis from consumed v3 pilot predictions and v2 features. It does not inspect v4 confirmation outcomes. `scripts/check_ml_v4_features.py` compares overlapping development records against the original v2 cache, requiring exact identities/categories and numeric agreement within declared float32 tolerances. Versioned files contain aggregate evidence and hashes; source records, labels, model packages and row-level predictions remain under ignored `training_data/`.

Shared merchant features require the broader observed transaction feed. A small single-account export cannot reproduce that context. This experiment does not change the API/UI or assert complete runtime delivery, calibrated probabilities, real-bank effectiveness or a successful upgrade before the confirmation gate is evaluated.
