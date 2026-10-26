# Reproduce the recall comparison

Use the project Python environment from the workspace root. Existing v8 feature caches, training identity/label records, model packages and prediction artifacts are dependencies. The original v4 development outcomes are additionally needed for the full historical online fit. Nothing downloads data or installs dependencies.

Replay the existing results:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v9.py
backend/.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests
backend/.venv/Scripts/mypy.exe --config-file backend/pyproject.toml backend/ml_v9
backend/.venv/Scripts/ruff.exe check backend/ml_v9 backend/tests/test_ml_v9.py
```

A new training rebuild must use a separate workspace without existing v9 output folders; the commands refuse to overwrite historical experiments:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe -m ml_v9.pipeline run
backend/.venv/Scripts/python.exe -m ml_v9.pipeline report
backend/.venv/Scripts/python.exe -m ml_v9.pipeline full
backend/.venv/Scripts/python.exe scripts/verify_ml_v9.py
backend/.venv/Scripts/python.exe scripts/report_ml_v9.py
```

`engine.apply` is the same inference implementation used for calibration replay and evaluation. Its serializable policies are in each experiment's `policies` field, with model configurations and package hashes beside them. The training pipeline handles feature loading and scoring; API handlers never train models. These are local research artifacts, not a deployed API or a claim that raw feature caches are publicly redistributable.

Selection and evaluation must remain separate. Do not adjust thresholds using evaluation labels, relax failed gates, overwrite artifacts, or describe this source as untouched. Full-data selection and merchant sensitivity are descriptive follow-through after pilot selection. No automatic runtime activation is performed.
