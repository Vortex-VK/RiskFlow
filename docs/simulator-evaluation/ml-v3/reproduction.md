# Reproduce the v3 experiment

Use the existing Python 3.13 environment and optional ML dependencies from v2. No packages or runtime dependencies were added. V3 requires the immutable v2 extraction and feature cache; [v2 reproduction](../ml-v2/reproduction.md) explains how to build them. Keep the original v1/v2 source and artifacts intact because their hashes are inherited.

From the project root in PowerShell, verify the frozen v2 input/model/source chain, pilot prediction hashes and candidate selection, then recompute the v3 confirmation report:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v3.py
```

This replay reloads the serialized models and checks all confirmation scores for exact equality, then requires the numerical report to match. Mismatches fail instead of replacing results. Re-reading consumed confirmation outcomes is a reproduction, not new evidence. A negative screening result is verified without reading confirmation labels.

To repeat the actual pilot fits and, if nominated, final fits and confirmation under an unused directory:

```powershell
backend/.venv/Scripts/python.exe scripts/run_ml_v3.py --name ml-v3-reproduction-01
```

The runner writes only under the new `training_data/<name>/` directory. It reuses the frozen feature cache, not the fitted v2 models. Every method is fitted on the same v3-allowed rows. Original outputs are never overwritten. This is an experiment reproduction on already used data, not an opportunity for new candidate selection or another independent significance claim.

For inspection, original stages are `python -m ml_v3.pipeline screen`, `finalize`, `score` and `report`, from the backend directory. Screening/final-model/prediction stages refuse existing or incomplete outputs. `report` permits identical replay. A stage failure does not authorize deleting checkpoints or changing protocol thresholds. Prefer the named rebuild runner for a repeat.

The versioned directory holds the design, protocol, complete two-seed screening metrics, final model manifest if applicable, frozen prediction manifest and confirmation results. Models and row-level predictions live under ignored `training_data/ml-v3/`. The label-access ledger distinguishes pilot fitting, screening, final fitting and confirmation. Confirmation reads require frozen predictions and hash verification; SQL label joins are limited to the selected population rather than reading excluded users' outcomes.

Verification commands:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -o addopts='' -q
backend/.venv/Scripts/python.exe -m mypy --config-file backend/pyproject.toml backend/app backend/ml backend/ml_v2 backend/ml_v3
backend/.venv/Scripts/python.exe -m ruff check --config backend/pyproject.toml backend scripts/run_ml_v3.py scripts/verify_ml_v3.py
backend/.venv/Scripts/python.exe -m ruff format --check backend scripts/run_ml_v3.py scripts/verify_ml_v3.py
```

The experiment does not activate a model in the app. Successful explanation arithmetic and serialization checks are research package checks; they do not replace the pending learned API/storage/UI integration. Existing rule assessments and the v2 evidence viewer are unchanged.

Generate the pilot/confirmation figure after a completed confirmation run with `backend/.venv/Scripts/python.exe scripts/render_ml_v3.py`.
