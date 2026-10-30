# RiskFlow Studio

RiskFlow is a fraud risk investigation app. Import a CSV, explore accounts and merchants in a graph, inspect review priorities, and replay the review queue with transaction evidence.

## Try it

From the project root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-RiskFlow.ps1
```

Open **http://127.0.0.1:5173**. The launcher starts the API on port 8000 and the frontend on 5173; Ctrl+C stops them. Logs go to `.cache/dev/`.

Choose **Samples**, open an example, and select **Simulate**. An IBM walkthrough and five authored synthetic scenarios contain 5, 50, 250, 1,000, 5,000 and 10,000 transactions. They show current-engine results at the automatic review capacity; the 250-row example is selected initially. Every example can also be downloaded as CSV. [Sample provenance and results](docs/sample-library/README.md).

**Import CSV** opens a temporary workspace and checks simulation inputs before building by default. Choose **Graph only** explicitly to investigate incomplete data; Simulate stays disabled until the missing inputs are supplied. The local API also supports retained datasets, corrections and immutable assessments in SQLite; these are not exposed in the workspace interface.

The **?** button opens a hands-on tour. Highlighted controls stay interactive; dimmed objects and controls are blocked for mouse, touch, and keyboard input. The background darkens through a transparent black overlay. The nine-step tour spotlights starter context, demonstrates the connection with a faint animated line, and finishes when Samples opens after reviewing Results. Edit scenario in the bottom playback bar returns to the board. Completing each action advances the tour automatically, from adding objects through saving a payment, simulation, and opening Results. Tour actions are normal workspace edits; skipping leaves your work in place. The circled **i** opens project information. Drag objects from **Objects** onto the canvas. Right-drag between an account and a merchant, device, or location to open the connection settings; **Add** saves it. Escape cancels the drag. For keyboard connections, focus an object and press **C**, then select the destination. **Clear board** sits beside Simulate and turns red on hover.

Account details put **Create starter context** directly below the name. It saves the name and creates connected device/location objects in one undoable action. The detail-panel × cancels unapplied edits. Payment **Additional information** is optional: blank fields use the merchant category, Chip Transaction, MCC 5411, and Completed when saved. CSV uploads preserve missing optional fields as unknown rather than applying these editor defaults.

## Model and inputs

The installed engine is **Stack-d5**, the accepted nonlinear stack. Eight frozen experts contribute reference-scaled scores; a depth-5 CatBoost head combines them with 33 prior-only transaction context fields. There is no fitting or automatic model selection during requests.

Replay shows each payment's rank, such as #4 of 250, and a priority score relative to the middle-ranked payment. The initial review queue uses unusually high scores across the upload. Drag the Review capacity slider left to include more payments, or right to include fewer; its marker shows the starting suggestion. This is a workload suggestion, not a fraud count or probability. Adding records can change rankings and the queue. Investigation does not authorize or block payments, and no alert does not establish safety.

Validated CSV previews and samples prepare results in the background. Simulate reuses that work. Playback counts, highlights, filters and Results follow the active upload queue. Selected payments show measured history comparisons and verified contribution charts. Queue changes are session-only; immutable API assessments and benchmark receipts retain their recorded policy. Historical probability assessments remain readable. [Review controls and explanation method](docs/stack-d5-integration/review-controls.md).

Supported model inputs are positive USD purchase amounts up to $1,000,000, stable account and merchant identities, and timestamps with an explicit timezone or date-only precision. Category/MCC, channel, completion status and merchant geography are optional. Date-only or mixed-precision files use whole-day history batches with calendar signals masked. Equal-time peers never contribute to one another's history. Native IBM exports retain the disclosed USD/UTC and completion-status adapter conventions. Labels are excluded from scoring. Unsupported retained records stay unassessed; graph-only imports can still display them.

The selected model's evidence is exposed development research, not independent validation on future uploads. The Samples panel separates curated demonstration results at automatic capacity from development evaluation at a fixed 5% review budget. Active sample files and compact integration receipts are included. Fresh, source-representative labels are needed before making deployment accuracy claims. [Integration details and migration checks](docs/stack-d5-integration/README.md).

## Installation

Use Node 24.22.0, Python 3.13 and uv. This workspace includes a local tool installation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\Use-ProjectTools.ps1
uv sync --project backend --locked
npm.cmd ci --prefix frontend
```

For a fresh checkout with those tools already on PATH, skip the local helper. Start services separately with:

```powershell
uv run --project backend uvicorn app.main:app --host 127.0.0.1 --port 8000
# In another terminal:
npm.cmd run --prefix frontend dev
```

API documentation is at `http://127.0.0.1:8000/docs`. Health reports `engine-ml-stack-d5` and validates the packaged models. Restart an older backend before using the current frontend.

All inference weights are included in `backend/model_artifacts/`. Training datasets and experiment caches are unnecessary for serving, building or testing the app. Stack-d5 is the current scoring package. Older bundles support explanations for historical assessments; their immutable names and hashes remain part of those contracts. [Component map](backend/model_artifacts/README.md).

The Dockerfile builds the frontend and packages the same API and weights. It enables public-demo mode: temporary CSV workspaces and simulations remain available, saved-dataset endpoints are disabled, and inference requests are bounded. Local development keeps retained-data support. See [deployment instructions](docs/deployment.md) for verification and limits.

## Public hosting

No hosting provider is configured. The portable Docker build enables anonymous public-demo mode and is verified by HTTP and browser checks. Target 1 CPU and 1 GiB RAM for the 10,000-payment limit; choose a provider's recurring free allowance based on actual usage. See [container documentation](docs/deployment.md) and [security boundaries](SECURITY.md).

## Verification and maintenance

From the project root:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe -m pytest backend/tests
backend/.venv/Scripts/python.exe -m mypy --config-file backend/pyproject.toml backend/app backend/ml
backend/.venv/Scripts/python.exe -m ruff check --config backend/pyproject.toml backend/app backend/ml backend/tests scripts
npm.cmd run --prefix frontend typecheck
npm.cmd run --prefix frontend lint
npm.cmd run --prefix frontend test
npm.cmd run --prefix frontend build
backend/.venv/Scripts/python.exe scripts/verify_api.py
npm.cmd run --prefix frontend test:browser
```

- `scripts/export_contracts.py` exports API and score contracts; follow it with `npm.cmd run --prefix frontend generate:types` after an intentional contract change.
- `scripts/refresh_samples.py` recomputes current IBM sample metrics while checking CSV hashes.
- `scripts/export_stack_fixtures.py` captures current API fixtures after an intentional model or contract change. Do not regenerate expected outputs merely to make a regression pass.
- `scripts/prepare_ibm_data.py` converts bounded original IBM data into normalized imports with separate labels; use `--help` for its selection options.

## Project layout

| Location | Purpose |
| --- | --- |
| `backend/app/` | API, transaction imports, assessments and persistence |
| `backend/ml/` | Inference, causal features and frozen component policies |
| `backend/model_artifacts/` | Required, hash-checked model components |
| `frontend/` | Graph workspace, import, samples, simulation and results |
| `contracts/` | Generated API and score specifications |
| `fixtures/` | Examples, frozen prediction receipts and saved-result compatibility fixtures |
| `scripts/` | Current setup, verification and maintenance tools |
| `training_data/`, `research/` | Local datasets, experiments and plans; excluded from Git and deployment |
| `docs/` | Current product documentation, sample provenance and integration receipts |

Historical model names in saved-result schemas and fixtures preserve compatibility; they are not selectable alternative engines. Raw datasets, research projects, internal plans and maintenance inventories stay local. The public tree retains runtime models and reviewed synthetic demo/test assets so a checkout can run and test the app. See the [repository policy](docs/repository-policy.md) for scope and publication checks.
