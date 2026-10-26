# Reproduce and inspect ML v2

Use PowerShell from the repository root, Python 3.13 and the existing local IBM CSV. The dependency lock and optional ML group are unchanged from v1:

```powershell
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache/uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.tools/python'
.tools/uv/uv.exe sync --project backend --locked --group ml
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
```

Verify all original input/cache/model/prediction hashes and recompute the published report:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v2.py
```

A report reproduction reads the same consumed outcomes and cannot establish a fresh statistical validation. A different numerical report is rejected rather than overwriting the original. Changes to frozen implementation or artifacts invalidate verification; preserve the version when starting a new experiment.

Rebuild extraction, features, selection, final models, diagnostics, feasibility, frozen predictions and reporting under a new local directory:

```powershell
backend/.venv/Scripts/python.exe scripts/run_ml_v2.py --name ml-v2-reproduction-01
```

Choose an unused name. The runner refuses existing directories, leaves the original `ml-v2` files untouched, and writes to `training_data/<name>/`. It copies the original design/dictionary/support-audit record. Expect CPU work for several minutes per stage; this is a deliberate offline experiment, not a background application task. Six-month fitting windows, sequential models and two threads bound resources. The source hash must match the original IBM file. Do not use a differently formatted CSV with this source-specific runner.

Individual original stages are available as `python -m ml_v2.prepare`, `ml_v2.build`, `ml_v2.train`, `ml_v2.diagnostics`, `ml_v2.feasibility`, `ml_v2.score`, and `ml_v2.report`. These commands target the original run and refuse replacing frozen extraction/features/models/predictions. Prefer the named rebuild runner. Partial extraction/feature stages remain visibly incomplete and are never treated as completed caches.

Local research outputs are ignored: `training_data/ml-v2/models/`, `predictions.parquet`, `demo.csv`, and `demo-learned.json`. The demo export contains full available context for development user 0 and no labels. The explanation file stores development examples, raw scores, contributions, measurements, support and complete preceding-window evidence IDs. It is an offline inspection artifact, not a calibrated fraud probability or released learned application view. Existing app imports continue to show rule assessments.

After the original run is complete, generate its aggregate comparison figure and a standalone interactive evidence viewer:

```powershell
backend/.venv/Scripts/python.exe scripts/render_ml_v2.py
```

Open `training_data/ml-v2/demo-inspector.html` locally. It displays saved contributions and model inputs, preceding completed purchases, and prior attempts including failures. Changing the selected example does not run a model. Examples are development transactions ranked by score; they are not asserted to be fraud. The SVG figure is written to the versioned report directory. EBM's built-in plotting warning about missing values does not apply to this viewer, which includes the model's actual missing-bin contributions and displays unavailable measurements explicitly.

The versioned directory contains aggregate metrics and provenance only. The source audit inspected development labels and label-blind date coverage, not reserved outcomes. The final test membership and periods are in `protocol.json`; candidate selection and search results are in `selection.json`. `predictions.json` establishes that scores were frozen before the final label join.

Checks:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests
backend/.venv/Scripts/mypy.exe --config-file backend/pyproject.toml backend/app backend/ml backend/ml_v2
backend/.venv/Scripts/ruff.exe check --config backend/pyproject.toml backend
backend/.venv/Scripts/ruff.exe format --check backend
```

No ML dependency was added to normal application startup. The frozen v1 modules were reused where their contracts fit, rather than modified; v2 features live under `backend/ml_v2/` to preserve v1's hashed feature implementation. `plan.md`, `todo.md`, existing saved assessment formats and prior frozen reports remain unchanged.
