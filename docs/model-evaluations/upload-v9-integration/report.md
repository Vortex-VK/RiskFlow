# Upload-v9 integration

The user explicitly selected the authored-adaptation candidate for the app after reviewing its cross-dataset regressions. **Upload-v9 / mixed-source now powers new simulations and retained model assessments.** This supersedes the earlier decision to keep the candidate offline. The statistical preservation gate remains failed; installation does not change the recorded evaluation.

## Exact installed model and policy

- Engine: `engine-ml-upload-v9`; model: `ml-upload-v9`; policy: `mixed-source`.
- Assessment version: `assessment-v2.9`; probability version: `fraud-probability-v2`.
- Bundle: `backend/model_artifacts/upload-v9/`; manifest SHA256: `58c9c2497c36ccd85c1553214ed104713d174dd4970ea6553f72bb8498495e67`.
- Exact `context_preserve.cbm` weights and sigmoid mapping from authored-adaptation-v3. No retraining or post-evaluation calibration.
- Card review cutoff: **88.83112967207818%**; online review cutoff: **96.25289733442912%**. These remain the frozen policy, rather than a new universal90% decision rule.

The model combines V8's route margin, frozen card-specialist/prioritizer margins and causal transaction context. Its dependencies are required for inference; missing or corrupt packages fail explicitly. V8 and card-package weights remain unchanged. Additional card review suggestions remain separate from the main decisions and are suppressed for transactions already flagged by V9.

The 90% highlight remains a visual cue and a threshold preview. New scores identify IBM/authored synthetic calibration. The frontend validates their version, bundle, sigmoid calculation, route and reference cutoff, while preserving historical V8 and older score contracts.

## App behavior

New simulations and saved assessments use V9. The API health endpoint advertises the new engine. Results, score exploration, exports, import controls, sample guidance and model details identify the active model. Saved assessments carry the new bundle and analysis version; old assessments retain their original model identity and probabilities.

Sample CSV bytes and labels were preserved. Their displayed metrics were recomputed for the installed policy:

| IBM sample | Transactions | Frauds detected | False alerts | Frauds missed |
| --- | ---: | ---: | ---: | ---: |
| First five | 5 | 0 | 0 | 0 |
| Short history | 50 | 2 | 0 | 5 |
| Online episode | 250 | 6 | 0 | 9 |
| Mixed channels | 1,000 | 19 | 0 | 0 |
| Many accounts | 5,000 | 83 | 0 | 30 |
| Full workspace | 10,000 | 93 | 0 | 30 |

The 186-row authored card demo now has nine detected frauds, one false alert and one additional legitimate review suggestion. No additional review is prioritized. It remains a curated demonstration, not a validation benchmark. Its content overlaps the authored source used in this research and must not establish heldout accuracy.

## Verification

- Packaged inference reproduces **every probability and review decision exactly** on four IBM populations totaling990,196 history-view rows and the1,935-row authored customer holdout. Wide/short histories share source transactions; they are not independent datasets. [Parity receipt](parity.json).
- **353 backend tests passed**, including frozen historical model tests, new candidate integrity, outcome independence, prefix causality and saved-result round trips.
- **238 frontend unit tests passed**, including V9 assessment decoding, altered-score rejection and all prior model compatibility fixtures.
- **19 targeted browser cases passed across the initial run and one clean rerun**: two10,000-row imports, retained10,000-row assessment/reopening, card review and score explorer/accessibility, generated-input handling, model-version handling, and all six samples.
- The first retained10,000-row browser case timed out while frontend files were being updated; its clean isolated rerun passed without an implementation change. The initial failure is retained in `.cache/v9-retained-first-run-context.md`. Dedicated test servers required verified cleanup after completed cases, as in previous runs.
- Backend Ruff and strict mypy, frontend TypeScript/ESLint and production build passed. The existing large JavaScript chunk advisory remains.
- The local backend on port8000 was restarted with its existing working directory and environment. Its health response reports V9. The frontend dev server remains on5173; retained user data was not reset.

## Scope and retained limitations

User selection authorizes installation despite the failed statistical gate. It does not establish general fraud reliability. Primary IBM precision declines relative to V8, older online recall is lower, Sparkov assumptions transfer poorly, and IEEE cannot directly supply this model's input contract. Probability calibration on arbitrary uploads remains unverified. See the [training/evaluation](../authored-adaptation-v3/report.md) and [cross-dataset report](../candidate-cross-dataset-v1/report.md).

Historical reports and research scripts remain immutable records of their own experiments. Current packaging and sample receipts are separate: [manifest](../../../backend/model_artifacts/upload-v9/manifest.json), [sample catalog](../../sample-library/upload-v9/catalog.json), [verification](verification.json).
