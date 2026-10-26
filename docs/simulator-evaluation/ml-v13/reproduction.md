# Reproduction

Use the existing backend Python environment and locked ML dependencies. From the repository root:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v13.py
backend/.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests
```

The verifier reads frozen model packages, regenerates all new and historical specialist scores, reselects preceding calibration policies, checks every alert using an independent causal implementation, and reproduces metrics and intervals. It verifies source identities, class labels, sampling weights, fitting chronology/user separation, package hashes and CatBoost parameters. Existing incumbent model replay is anchored to the frozen v12 verifier. Only v13 reproduction-check.json is written.

Original generation from backend:

```powershell
.venv/Scripts/python.exe -m ml_v13.pipeline run
.venv/Scripts/python.exe -m ml_v13.pipeline full
```

Run trains six models once, generates three pilot periods and freezes candidate selection. Full follows that frozen selection on the full recent incumbent; new specialists retain their pilot training population. Do not run full when selection is baseline and no improved candidate warrants follow-through. Both commands reject overwriting existing training outputs. Use an isolated copy with the existing source, features and earlier packages and without v13 generated training folders to rebuild. Do not delete frozen outputs in this workspace. A second complete training rebuild has not been claimed.

From the root, scripts/report_ml_v13.py regenerates only this round's presentation report. It imports formatting helpers from the earlier report script without executing that script or modifying old reports. All raw/derived transaction records and model packages stay in ignored training_data. No external source or runtime integration is required for this experiment.
