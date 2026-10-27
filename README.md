# RiskFlow Studio

RiskFlow is a fraud risk investigation app. Import a CSV, explore accounts and merchants in a graph, inspect estimated fraud probabilities, and replay model decisions with transaction-level explanations.

## Try it

From the project root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-RiskFlow.ps1
```

Open **http://127.0.0.1:5173**. The launcher starts the API on port 8000 and the frontend on 5173; Ctrl+C stops them. Logs go to `.cache/dev/`.

Choose **Samples**, open an example, and select **Simulate**. Six curated IBM examples contain 5, 50, 250, 1,000, 5,000 and 10,000 transactions. The first three showcase verified detections with the current engine; the 250-row example is selected initially. Every example can also be downloaded as CSV. [Sample provenance and results](docs/sample-library/README.md).

**Import CSV** opens a temporary workspace and checks simulation inputs before building by default. Choose **Graph only** explicitly to investigate incomplete data; Simulate stays disabled until the missing inputs are supplied. The local API also supports retained datasets, corrections and immutable assessments in SQLite; these are not exposed in the workspace interface.

The **?** button opens a hands-on tour. Highlighted controls stay interactive; dimmed objects and controls are blocked for mouse, touch, and keyboard input. The background darkens through a transparent black overlay. The nine-step tour spotlights starter context, demonstrates the connection with a faint animated line, and finishes when Samples opens after reviewing Results. Edit scenario in the bottom playback bar returns to the board. Completing each action advances the tour automatically, from adding objects through saving a payment, simulation, and opening Results. Tour actions are normal workspace edits; skipping leaves your work in place. The circled **i** opens project information. Drag objects from **Objects** onto the canvas. Right-drag between an account and a merchant, device, or location to open the connection settings; **Add** saves it. Escape cancels the drag. For keyboard connections, focus an object and press **C**, then select the destination. **Clear board** sits beside Simulate, Undo and Redo and turns red on hover.

Account details put **Create starter context** directly below the name. It saves the name and creates connected device/location objects in one undoable action. The detail-panel × cancels unapplied edits. Payment **Additional information** is optional: blank fields use the merchant category, Chip Transaction, MCC 5411, and Completed when saved. Explicit values are preserved; CSV import validation remains unchanged.

## Model and inputs

The installed probability engine is **Upload-v9 / mixed-source**, with a card-pattern specialist. It uses trained IBM/authored outputs and strictly prior transaction history. New runs expose probabilities on a 0 to 100 scale, raw margins and evidence for investigation.

Validated CSV previews and newly opened samples prepare model results in the background. **Simulate** reuses that work, including an in-flight request, without revealing decisions or advancing playback early. Only one draft is cached in memory; input changes invalidate it, failures remain retryable, and a new simulation consumes the prepared result.

The model's review cutoffs are **88.83% for card purchases** and **96.25% for online purchases**. A separate **90%+ highlight** helps scan the interface; it does not replace those cutoffs. Alerts recommend review and do not block payments. The assessed, review and no-alert counters increase as playback reveals completed transactions. Coral payment paths and per-group review counts follow the same progress. Flagged merchant endpoints carry a coral ring and warning marker, with a stronger ring on the selected flagged payment. **Flagged only** dims unrelated graph context without changing its layout; **Next flagged** opens the next recorded alert. Rewinding resets the visible counts and highlights; inspection and the results panel retain access to the completed assessment without changing the playback clock. The playback controls remain in the bottom bar, without a timeline scrubber. Payment details show the primary estimate once, distinguish the review decision from observed evidence, and show a compact probability walkthrough from the baseline to the final estimate. The **Other** group expands into the remaining factors, with signed percentage-point changes and running estimates. These steps depend on the displayed order; they are not independent probability contributions. Technical measurements stay expandable. A probability threshold slider below the summary previews a common cutoff across probability-scored payments. Counts, graph highlights, filters and dataset results update together; Reset defaults restores the recorded model decisions. Scores and saved results are unchanged. Dataset results lead with review workload, payment values, frauds found and missed, false alerts, precision and recall when labels exist. Results presents workload and flagged value, affected accounts and merchants, history coverage, the probability distribution, and detection against supplied labels. **Where alerts concentrate** groups alerts by channel, merchant category and merchant. **Patterns worth investigating** highlights observed connections and activity in the current run. Without outcome labels, accuracy metrics are omitted; single-class inputs omit unsupported comparisons while meaningful zero outcomes remain. Model benchmarks live in Samples rather than Results. Card-specialist signals still contribute to the primary model; supplementary review suggestions are not added to its outcome counts.

Model scoring supports positive USD purchases with precise timestamps, account and merchant identities, a four-digit MCC, completion status, and a Chip, Swipe or Online Transaction channel. Merchant geography is optional. Native IBM card exports map User + Card, Use Chip, Merchant Name, MCC and Errors? automatically, with disclosed USD/UTC assumptions. Outcome labels are used only for evaluation. Unsupported retained rows remain visible as not assessed.

The installed model detected **257 of 263 frauds (97.72% recall)** with **20 false alerts (92.78% precision)** on the 334,777-transaction primary IBM evaluation at its frozen cutoffs. On the separate authored customer holdout it detected 23 of 30 frauds with 2 false alerts across 1,935 transactions. **Samples > Overall model evaluation** presents these benchmark results independently of the selected sample. **Results** contains only the current CSV's assessment and detection metrics. Both sources are synthetic: source transfer, history depth and calibration still matter. Sparkov transfer was poor, and the model trades some IBM precision and older-online recall for improved authored detection. Validate a new source before automating decisions; curated examples alone are not a validation benchmark. [Model integration](docs/model-evaluations/upload-v9-integration/report.md) and [cross-dataset results](docs/model-evaluations/candidate-cross-dataset-v1/report.md) document the measured improvements and regressions.

Payment explanations use [CatBoost Tree SHAP](https://catboost.ai/docs/en/concepts/shap-values) for the frozen final decision model. Contributions plus the model baseline must reproduce the saved raw score; the UI also verifies model identity, event identity and calibrated probability. Earlier detector outputs are treated as inputs, so this is final-stage attribution rather than end-to-end attribution or a causal claim. Explanations load only when inspecting a payment, keeping bulk simulation preparation fast. Saved assessments whose original history or model cannot be reproduced show an explicit unavailable state. The stateless `/api/v1/explanations` endpoint uses the same validation and public-demo inference limits as simulation.

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

API documentation is at `http://127.0.0.1:8000/docs`. Health reports `engine-ml-upload-v9` and validates the packaged models. Restart an older backend before using the current frontend.

All inference weights are included in `backend/model_artifacts/`. Training datasets and experiment caches are unnecessary for serving, building or testing the app. Several versioned bundles are internal components of the installed engine; their immutable names and hashes are part of the model contract. [Component map](backend/model_artifacts/README.md).

The Dockerfile builds the frontend and packages the same API and weights. It enables public-demo mode: temporary CSV workspaces and simulations remain available, saved-dataset endpoints are disabled, and inference requests are bounded. Local development keeps retained-data support. See [deployment instructions](docs/deployment.md) for verification and limits.

## Public hosting

Public deployment is deferred. Run RiskFlow locally using the instructions above. Provider-specific deployment configuration has been removed; the portable Docker build and its verification checks remain available for future use. Any future hosting must stay free. See [container documentation](docs/deployment.md).

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
- `scripts/capture_runtime_fixtures.py` captures current API fixtures after an intentional model or contract change. Do not regenerate expected outputs merely to make a regression pass.
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
| `training_data/` | Original source datasets retained for future research; excluded from deployment |
| `docs/` | Product documentation, evaluation reports and historical Markdown |

Historical model names in saved-result schemas and fixtures preserve compatibility; they are not selectable alternative engines. Retired experiment runners, unused models and generated training caches have been removed. [Cleanup record](docs/maintenance/cleanup/report.md) explains the retained dependencies and the scope of reproducibility. [Historical documentation](docs/archive/README.md) preserves the development trail.
