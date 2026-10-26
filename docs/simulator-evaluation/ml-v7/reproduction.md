# Historical, interrupted v7 experiment

V7 was stopped after numerical instability invalidated its EBM baseline and miner. See [the report](report.md). The full follow-through, routing and complete three-fold verification described in the initial design were not executed. Use v8 for the repaired experiment.

The source audit remains runnable:

```powershell
backend/.venv/Scripts/python.exe scripts/audit_ml_v7_source.py
```

The first-period models, predictions, calibration data, mining data and implementation hashes remain under `training_data/ml-v7/2016Q4-pilot` and `2016Q4.json`. Numerical failure can be inspected without refitting by loading the saved EBM intercepts/terms and examining the frozen scores. Do not interpret the resulting all-alert cutoff as an accepted operating policy.

All initial protocols, compute/coverage amendments and partial runs are retained. No historical output should be overwritten to make a rerun succeed. A complete execution of the frozen v7 pipeline in a separate workspace reproduces the original workflow, including its missing numerical guard; it is a historical research artifact, not the recommended trainer.
