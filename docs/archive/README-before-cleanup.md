# RiskFlow Studio

**Upload-v9 / mixed-source is installed**, following the user's selection of the evaluated authored-adaptation candidate. New runs expose trained IBM/authored probability estimates, with frozen card88.83% / online96.25% review cutoffs and a separate90% high-estimate highlight. Historical V8 results remain readable. Sample metrics now reflect V9; CSVs are unchanged. [Integration and verification](docs/model-evaluations/upload-v9-integration/report.md).

The candidate improves the authored customer holdout but lowers primary IBM precision and older-online recall. It was selected despite failing the statistical preservation gate. [Cross-dataset evaluation](docs/model-evaluations/candidate-cross-dataset-v1/report.md). The paragraphs below record earlier modeling stages.

**Previous engine: Upload-v8 / precision95 remains frozen**, following the user's selection. It retains 97.01% precision / 98.86% recall on the reused IBM longer-history test and its previously documented online/transfer regressions. A separate experimental card-pattern reviewer adds investigation suggestions without changing model alerts or metrics. It finds 13 additional authored-scenario frauds with seven legitimate suggestions, but adds 216 legitimate suggestions and no fraud detections on the primary IBM test. [Implementation, measurements and limitations](docs/model-evaluations/card-pattern-v1/report.md).

**Card review prioritization is now installed.** A second model puts six of those 13 scenario frauds first, with zero legitimate purchases in that priority group. All remaining leads stay visible, including the 216 primary IBM false suggestions; none of those is prioritized. This improves review order, not recall or overall false-positive counts. [Experiments, current behavior and limits](docs/model-evaluations/card-pattern-v5/report.md).

The subsequent recall-focused study expanded training to 2,518 fraud transactions, but the selected extension failed later calibration. It was not installed; current review coverage and v8 results remain unchanged. [Recall experiment and decision](docs/model-evaluations/card-pattern-v7/report.md).

Try **Samples → Open card-review demo → Simulate → Results → Experimental card reviews**. This separate 186-row authored example shows both useful suggestions and a legitimate purchase suggested for review. The six original IBM samples remain unchanged and now display their own current model results.

RiskFlow is a transaction-investigation portfolio project with **behavioral observations, graph investigation, and explicit model benchmarks**. Matching CSV columns does not establish that a fraud model is valid for that source. Historical V13, Upload-v5 and Upload-v7 results are preserved. The deterministic point-scoring engine has been removed.

Retained datasets default to **Behavioral observations**: prior purchase counts, amount comparisons and supporting records without a fraud score. Open **Datasets**, then **Describe purchase history**. Try the authored [example CSV](fixtures/runtime/behavioral-observations.csv). Merchant, channel, MCC and completion status are optional for this mode; positive outgoing USD purchase activity, account identity and usable time must be supplied or explicitly declared. Date-only records use previous-day history. Temporary CSV imports default to **Graph investigation**, without model scoring or model-only field requirements.

The [strategy revision and V13 audit](docs/model-evaluations/strategy-v1/report.md) reproduce the preserved IBM results and document reused evaluation populations and missing historical fitting evidence. The separate [IEEE-CIS benchmark](docs/model-evaluations/ieee-v1/report.md) compares basic-feature logistic regression and CatBoost with provider-feature CatBoost using chronological selection, calibration and a frozen final period. IEEE models remain offline; their anonymized inputs are not ordinary-upload predictors.

On the IEEE final period, the selected model catches **347 of 1,596 frauds among 413 reviews** at the daily 1% budget (84.02% precision), versus 131 for the logistic baseline. At the daily 5% budget it catches 839 (52.57% recall). AP is 0.5061. These results cover 40,641 transactions over fifteen relative days and do not establish accuracy on other sources.

The [portable-engine implementation report](docs/model-evaluations/behavioral/v1/report.md) records the separate Handbook experiments and IBM transfer diagnostic. Portable learned models remain offline; their performance does not justify replacing V13 for ordinary uploads.

The [multi-source experiment](docs/model-evaluations/behavioral/multisource-v1/report.md) compares separate and combined training, relative features, and degraded histories at equal daily review capacity. These reused synthetic datasets support development diagnostics; they do not establish performance on unseen uploads.

The [context-feature follow-up](docs/model-evaluations/behavioral/robust-v2/report.md) expands IBM coverage and tests a held-out Sparkov source plus the supplied 10,000-row upload. Richer context substantially improves IBM detection but regresses on the held-out source and remains weak on the upload. Its models remain offline; the report explains the generalization failure and next validation steps.

The [three-domain follow-up](docs/model-evaluations/behavioral/multidomain-v3/report.md) adds date-only context, whole-source model selection, and a fresh BankSim test. The selected model improves the supplied upload from 8 to 23 detected fraud cases at the same daily 1% review budget, but regresses on IBM. All 18 fits and 238 final comparisons are recorded; the generalization gate failed and V13 remains unchanged.

The historical V13 synthetic IBM benchmark measured **98.86% precision, 79.09% recall, 99.9537% accuracy and 87.88% F1**. These are repeatedly exposed research results, not independent validation or guaranteed upload performance. [Model evidence and limitations](docs/ml.md).

The prior [upload-v5 sequence experiment](docs/ml.md#upload-v5-sequence-refinement-fewer-false-alerts-recall-not-confirmed-2026-10-25) reduces primary false alerts from 21 to 10 on 188,356 reserved 2020 transactions, but those records contain no fraud and cannot validate recall. On an explicitly reused 2019Q4 diagnostic, its higher-recall option reaches 90.54% precision / 80.72% recall, versus upload-v4's 76.92% / 84.34%: 14 fewer false alerts and three fewer detections. The unchanged 10,000-row example improves from 100 caught frauds with five false alerts to 105 with none. The 90%/90% target is not established; the user explicitly requested installation, and the app used that frozen Upload-v5 policy before the Upload-v7 replacement above. Earlier experiments and all limitations remain documented.

## Try the IBM samples

Choose **Explore samples** in the empty workspace or **Samples** in the toolbar. The library offers **5, 50, 250, 1,000, 5,000 and 10,000 transactions**, from a few everyday purchases to mixed card histories and known fraud episodes. Select **Open in workspace**, then **Simulate** to run Upload-v8. Every sample can also be downloaded as a CSV and imported manually.

The files preserve IBM synthetic transaction values and source labels. The library reports each file's own measured detections and misses; these curated examples are not a new accuracy benchmark. The 250-row example is the suggested starting point. Larger examples use the existing grouped graph. [Sample details and reproduction](docs/sample-library/README.md).

## Run locally

From the project root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-RiskFlow.ps1
```

Open **http://127.0.0.1:5173**. The launcher starts the backend on port 8000 and frontend on 5173. Stop an existing launcher with Ctrl+C before restarting. Logs are in `.cache/dev/`.

The workspace opens empty. Choose **? > Scenario options > Account Takeover** for an authored model-input example, then **Simulate > Events** to inspect Upload-v8 alerts, history support and raw model margins. These examples illustrate the interface; their story labels are not model-validation evidence. Changing graph layout or device familiarity does not change Upload-v8 predictions.

**Import CSV** creates a temporary sandbox. **Datasets** saves records, append-only corrections and immutable assessments in local SQLite. Refresh opens an empty sandbox; saved datasets open explicitly. Existing historical rule assessments remain readable with their original results.

## Inputs and results

Upload-v8 supports USD purchases with precise timestamps, scoped account/merchant identities, positive amounts, a four-digit MCC, and one of `Chip Transaction`, `Online Transaction`, or `Swipe Transaction`. Completion status distinguishes past spending from failed attempts. Merchant city/state/ZIP are optional merchant geography, not customer location. The payment editor exposes these fields. Download the example CSV from the import panel or use `fixtures/runtime/demo-purchases.csv` with Datasets.

The importer also recognizes separate **Year, Month, Day and Time** columns. Native IBM-style card exports additionally map **User + Card**, **Use Chip**, **Merchant Name**, **MCC**, merchant geography and **Errors?** automatically. In that format, blank Errors? means completed and other values mean failed; USD and UTC are disclosed assumptions. Override the UTC offset if needed. Minute-only timestamps retain `:00` seconds. Negative card amounts are incoming adjustments, excluded from sandbox purchases and retained without purchase scoring in Datasets. Optional `Is Fraud?` labels populate sandbox truth metrics only; they never enter model predictors. Generic split-date exports still require an explicit offset when their times lack a timezone.

Retained CSVs use `event_id`, `account_id`, `timestamp`, `amount`, `currency`, `direction`, `transaction_type`, `status`, `merchant_id`, `merchant_category` (`MCC 5411`, for example), and `channel`. Alternatively supply a separate `mcc` column. Optional `merchant_city`, `merchant_state`, and `merchant_zip` are preserved. Unsupported retained records remain visible as **not assessed**. Temporary CSV graph imports accept meaningful transaction records without model-only fields. Choosing **Upload-v8 benchmark simulation** requires every included payment to pass the strict model-input check during preview. Simulations also validate inputs and never fall back to rule scoring.

Each Upload-v8 request computes strictly prior account and merchant features and applies the frozen model policy. There is no daily evaluation requirement and no training during requests. An alert means **review**, and no alert is not a safety guarantee. Upload-v8 does not automatically block payments. New results expose **estimated fraud probabilities** from trained output models, alongside exact raw margins, for V8 and every eligible card-specialist transaction. Their calibration is based on IBM synthetic development data and is unverified for custom uploads. Each model displays its own reference probability cutoff; 50% is not the default verdict. The legacy rule-engine score fields remain null. Legacy review/block thresholds are ignored. Illustrative cost assumptions remain editable.

Inspect a payment for its probability estimates, or open **Results → Scores and threshold explorer** to rank transactions, preview the precision/recall tradeoff, inspect Brier/log loss and reliability groups, and download exact scores. Evaluation metrics require labeled data and are reported separately by model. Saved assessments retain probabilities; older display-index assessments retain their original meaning. Four probability output models were trained; the underlying V8 weights and reference alerts remain unchanged. This is not an accuracy improvement: V8 aggregate RMSE worsened on primary IBM and authored-scenario diagnostics. [Training, specification and evaluation](docs/model-evaluations/probability-v1/report.md).

Uploaded histories have no confirmed delayed merchant-fraud feedback, so those features use zero support and results disclose partial context. Short histories and missing geography can change performance relative to the benchmark. Request history is rebuilt from the submitted snapshot; retained datasets provide continuity across uploads. `as_known` selects a source-availability snapshot, not a per-authorization historical backtest.

## Installation

For the existing local tool installation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\Use-ProjectTools.ps1
uv sync --project backend --locked
npm.cmd ci --prefix frontend
```

A fresh environment needs Node 24.22.0 and uv with Python 3.13; with those on PATH, skip the local helper. All inference dependencies are in the locked runtime installation. The checked model bundles are included in `backend/model_artifacts/upload-v7/` and its retained online dependency `backend/model_artifacts/v13/`; serving the application does not require `training_data/`. Missing or incompatible packages produce an explicit unavailable error. Docker copies the same bundle; Docker execution remains unverified locally.

Run services separately if preferred:

```powershell
uv run --project backend uvicorn app.main:app --host 127.0.0.1 --port 8000
# In another terminal:
npm.cmd run --prefix frontend dev
```

Backend API documentation: `http://127.0.0.1:8000/docs`. Health reports `engine-ml-upload-v7` and checks that the model package loads. Model requests use `/api/v1/simulations`; retained datasets use `/api/v2/datasets`.

If an already-running backend reports `engine-v1`, `engine-ml-v13` or `engine-ml-upload-v5`, restart it before using the updated frontend. A backend process keeps its previously loaded code until restarted. The app checks readiness and engine compatibility before loading templates, simulating or starting assessments, and gives restart guidance instead of sending model inputs to an old server. Missing model fields block the Upload-v8 simulation import purpose; retained-import preview and assessment disclose unsupported rows for the selected analysis mode.

For the supplied GPT-generated 2,400-row dataset, see the [experiment findings](docs/ml.md#generated-2400-row-experiment). The original lacks required model inputs and fraud labels. Explicitly assumed variants in `fixtures/evaluations/generated-2400/` can be imported for a working demonstration, but their predictions do not measure fraud-detection accuracy.

The supplied labeled 10,000-row card-format test measured **15.69% precision and 23.89% recall** with V13, Upload-v5 and Upload-v8. See the [evaluation and confusion counts](docs/ml.md#supplied-10000-row-card-format-test); the original IBM benchmark does not establish performance on this separate test.

## IBM import preparation

The original IBM CSVs remain under `training_data/`. Create bounded normalized imports with explicit channel/MCC/geography, keeping labels in separate files:

```powershell
backend/.venv/Scripts/python.exe scripts/prepare_ibm_data.py --start 2018-01-01 --end 2018-02-01 --users 2 --output training_data/imports/ibm-example
```

The output directory must be new. This creates two bounded user groups; these names do not establish a new validation split. IBM lacks timezone information, so the adapter records the synthetic-clock-as-UTC assumption. Its large source file is not intended for direct browser upload.

## Verification

```powershell
backend/.venv/Scripts/python.exe scripts/export_contracts.py
npm.cmd run --prefix frontend generate:types
npm.cmd run --prefix frontend typecheck
npm.cmd run --prefix frontend lint
npm.cmd run --prefix frontend test
npm.cmd run --prefix frontend build
npm.cmd run --prefix frontend test:browser
cd backend
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m mypy app ml
.venv/Scripts/python.exe -m ruff check app ml tests
```

Research replay additionally needs the retained local artifacts and `uv sync --project backend --locked --group ml`. From `backend`, run `python -m ml.verify` for the retained accepted-model checks and `python -m ml.verify_runtime` for packaged-inference parity. The latter matches all five component score vectors and all decisions on 51,889 frozen feature rows. The strategy audit distinguishes reproduced scores from historical fitting tables that cleanup no longer preserves; it does not certify a complete raw-to-feature rebuild.

## Project layout

| Location | Purpose |
| --- | --- |
| `backend/app/` | API, imports, lifecycle accounting, model input adapter, results and storage |
| `backend/ml/` | Shared causal features, trained-model inference, policies and research verification |
| `backend/model_artifacts/v13/` | Ten frozen model components and hash-checked inference manifest |
| `frontend/` | Editor, graph, CSV import, replay and saved-dataset interface |
| `contracts/` | Generated API contract |
| `fixtures/` | Authored examples, regression inputs and historical saved-result compatibility fixtures |
| `training_data/` | Original IBM data and accepted-model research replay dependencies; not required to serve |
| `docs/maintenance/` | Cleanup inventories and verification records |
| `docs/simulator-evaluation/` | Historical experiment findings and accepted-model provenance |

The cleanup removed 1,462 generated data files (11,721,702,139 bytes), retired rule-scoring source and old experiment runners, and kept original inputs and accepted-model evidence. Historical documentation and screenshots may describe retired behavior; this README and [ML guide](docs/ml.md) describe the current runtime. Personal planning files are unchanged.
