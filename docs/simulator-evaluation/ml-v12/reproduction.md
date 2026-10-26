# Reproduction

Use the existing backend Python environment with the locked ML dependencies. From the repository root:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v12.py
backend/.venv/Scripts/python.exe -m pytest -c backend/pyproject.toml backend/tests
```

The verifier replays both v11 and v12. It checks frozen inputs and specialist packages, scores the historical EBM/CatBoost models again, reselects calibration policies, independently computes causal alerts, and checks saved outcomes, all metrics and intervals. It writes only each new round's reproduction-check.json. The incumbent's earlier exact model-score replay is preserved and hash anchored. No second full training rebuild is claimed.

Original generation commands, from backend, were:

```powershell
.venv/Scripts/python.exe -m ml_v11.pipeline run
.venv/Scripts/python.exe -m ml_v12.pipeline run
.venv/Scripts/python.exe -m ml_v12.pipeline full
```

These commands intentionally refuse to overwrite existing experiment folders. Rebuild in an isolated copy with the original source, feature caches and model artifacts, without the v11/v12 training output folders. Preserve this workspace's frozen files. Generation needs no download or model training. V11 did not qualify for a full-data comparison; v12 selected combined before its full follow-through. Report regeneration uses scripts/report_ml_v12.py after verification and writes only v11/v12 presentation artifacts.

Full inference uses the frozen v10 policy and its v8 full weighted EBM/v9 full CatBoost, plus v8 2016Q4 historical soft CatBoost and v9 2016Q4 historical online EBM. Every model family has two frozen seeds. Feature order/configuration remains in original metadata. V12's full frozen.json records policy and input hashes; candidate-model-v12.json references it and the exact model packages. Raw scores are uncalibrated model scores, not probabilities.

All derived records stay in ignored training_data. Reports expose aggregate results only. This is offline batch inference with state reset at evaluation boundaries, not a production streaming release. No new dependencies or UI/application changes were made. The accepted v10 pointer is retained and v12 recorded as a validated challenger.
