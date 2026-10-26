# Reproduce the precision experiments

Use the existing project-local Python environment and ML dependencies. V5 and its conditional v6 fallback reuse the immutable v4 base/context caches. They do not need another download or feature extraction. Original source files and previous experiment artifacts must remain present and match their frozen hashes.

Run from the repository root in PowerShell:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v5.py
backend/.venv/Scripts/python.exe scripts/verify_ml_v5.py --version ml-v6
backend/.venv/Scripts/python.exe scripts/plot_ml_precision.py
```

The verifier checks ancestor artifacts, source and cache hashes, model packages, every saved development score, cutoff selection and development gates. For v6 it also reproduces the chronological miner's scores and the hard-negative weights. If a candidate advanced, it checks every confirmation score and fixed decision, then reproduces the numerical report. Negative screening verifies that its ledger has no reserved-label access. Report replay uses already-consumed outcomes and is not a new statistical test. Any mismatch fails.

To repeat fitting and policy selection in an unused directory:

```powershell
backend/.venv/Scripts/python.exe scripts/run_ml_v5.py --name ml-v5-reproduction-01
backend/.venv/Scripts/python.exe scripts/run_ml_v5.py --version ml-v6 --name ml-v6-reproduction-01
```

V6 deliberately reuses the original v5 incumbent packages; its rebuild refits the chronological miner and weighted sequence candidate. These commands reuse the validated feature caches; they are not full IBM extraction rebuilds. See [v4 reproduction](../ml-v4/reproduction.md) for rebuilding those caches in isolation. Existing or incomplete output directories cannot be overwritten.

Individual stages, from `backend/`, are `python -m ml_v5.pipeline develop` and `python -m ml_v6.pipeline develop`, `score`, `report`. Score/report run only when the frozen development gate passes. The v6 process binds the v5 evaluation functions to its own protocol, directories and ledger; launch each version in a separate process. The internal `sequence` key refers to the ordinary sequence model in v5 and the weighted sequence model in v6. Native explanation arithmetic and exact serialization replay are checked during fitting.

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -o addopts='' -q
backend/.venv/Scripts/python.exe -m mypy --config-file backend/pyproject.toml backend/app backend/ml backend/ml_v2 backend/ml_v3 backend/ml_v4 backend/ml_v5 backend/ml_v6
backend/.venv/Scripts/python.exe -m ruff check --config backend/pyproject.toml backend scripts/run_ml_v5.py scripts/verify_ml_v5.py
backend/.venv/Scripts/python.exe -m ruff format --check --config backend/pyproject.toml backend scripts/run_ml_v5.py scripts/verify_ml_v5.py
```

Models, mining rows, labels and predictions stay under ignored `training_data/`. Versioned reports contain aggregate results and hashes. Neither experiment installs a model into the application or changes existing saved assessments. A complete second training rebuild has not been run; report/score replay and full refitting are different checks.

The plotting helper uses Matplotlib to render the aggregate development curves and frozen confirmation policies. It also stores complete development precision/recall arrays in `training_data/ml-v6/development-pr-curves.npz`. It selects no new policy and does not inspect unused outcomes.
