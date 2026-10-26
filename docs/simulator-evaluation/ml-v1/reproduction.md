# Reproduce ML v1

Run from the repository root in PowerShell. Use the project's Python 3.13 environment and local uv binary. The existing IBM source must be at `training_data/credit_card_transactions-ibm_v2.csv`; the runner checks its SHA-256 before extraction. No new data download is necessary.

```powershell
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache/uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.tools/python'
.tools/uv/uv.exe sync --project backend --locked --group ml
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
```

The dependency install may need network access on a new machine. ML packages are optional research dependencies. Python/Windows compatibility, estimator serialization and local fitting were verified in this workspace; this is not a published runtime model installation.

## Verify the existing result

With the original ignored research files still present:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_experiment.py
```

This verifies the actual extraction databases and feature cache against their manifests, then checks frozen code/input/prediction hashes before joining June outcomes. It recomputes the report and refuses to overwrite a different result. Use `--name <run-name>` for another local reproduction. The low-level `ml.report` module verifies the frozen manifests and predictions; this entrypoint additionally verifies their underlying cached data files. Repeating the identical report is reproduction of a consumed test, not a new validation. Editing hashed source, input contracts or models deliberately invalidates verification. Preserve the original version when developing another experiment.

## Rebuild in a separate directory

```powershell
backend/.venv/Scripts/python.exe scripts/run_ml_experiment.py --name ml-reproduction-01
```

Choose an unused lowercase run name. The runner refuses `ml-v1` and any existing output directory. It places all derived data, estimators and aggregate reports under `training_data/<name>/`, preserving the published run. It executes extraction, features, development audit, fixed-model fitting/refitting, import parity, feasibility, prediction freeze, then the final report. Expect several minutes of CPU/disk work and roughly a gigabyte of process memory on the measured workload. Staging directories are deliberately not reused after failure; use a new name while investigating rather than treating incomplete output as finished.

The feature dictionary is copied into the new run. Training/report provenance hashes and timing values may differ between runs, including paths and model serialization metadata. Compare the selected candidate, support, per-model predictions/ranking metrics and gates, rather than claiming byte-identical reports with different provenance. This rebuild uses the same already-consumed test definition and must not be described as fresh evidence.

## Inspect and demonstrate

Read [report.md](report.md), [results.json](results.json), [selection.json](selection.json), [calibration.json](calibration.json), [input-contract.json](input-contract.json) and [parity.json](parity.json). Individual predictions, source records and outcome databases remain local and ignored.

`training_data/ml-v1/demo.csv` is the bounded label-free development export with full available context. Import it through the existing retained-history interface. The current app displays rule assessments; learned results are research outputs because the promotion gate failed. There is no runtime model activation command in this release.

The optional static figure is regenerated from aggregate results with:

```powershell
$env:MPLCONFIGDIR = Join-Path (Get-Location) '.cache/matplotlib'
backend/.venv/Scripts/python.exe scripts/render_ml_figure.py
```

Checks for the changed backend:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests
backend/.venv/Scripts/mypy.exe --config-file backend/pyproject.toml backend/app backend/ml
backend/.venv/Scripts/ruff.exe check --config backend/pyproject.toml backend
backend/.venv/Scripts/ruff.exe format --check backend
```

There are no handwritten implementation comments in the new modules. The existing personal `todo.md`, global `plan.md`, old saved contracts, source CSV and prior evaluation reports are not changed by this workflow.
