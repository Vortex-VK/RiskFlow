# Reproduce the corroboration follow-up

This stage uses the completed v9 predictions and full-data CatBoost, plus the unchanged v8 incumbent. It does not train another model. Run the v9 verification first because it replays every reused model score.

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v9.py
backend/.venv/Scripts/python.exe scripts/verify_ml_v10.py
backend/.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests
backend/.venv/Scripts/mypy.exe --config-file backend/pyproject.toml backend/ml_v9 backend/ml_v10
```

To rebuild policies in a separate workspace without existing v10 outputs:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe -m ml_v10.pipeline run
backend/.venv/Scripts/python.exe -m ml_v10.pipeline full
backend/.venv/Scripts/python.exe scripts/verify_ml_v10.py
backend/.venv/Scripts/python.exe scripts/report_ml_v10.py
```

Preserve historical artifacts. Never rerun by deleting outputs, tune a cutoff on evaluation labels, or substitute another full-data candidate after the preselected candidate fails. Follow-up results remain exploratory and adaptive despite hash checks and adjusted conditional intervals. Application activation is not part of these commands.
