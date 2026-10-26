# RiskFlow portfolio showcase plan

Updated: 2026-10-25, America/New_York.

## Decision and scope

**Upload-v9 is now installed by explicit user selection.** The user requested connecting the evaluated authored-adaptation candidate after reviewing the cross-dataset results. New simulations and retained assessments use the exact frozen `context_preserve` model, its probability mapping, and the card88.83% / online96.25% review cutoffs. The 90% highlight remains separate. V8 weights and historical runs are preserved; sample metrics and app labels are refreshed. This supersedes the offline decision below without changing its failed statistical gate or documented regressions. [Integration and verification](docs/model-evaluations/upload-v9-integration/report.md).

**Completed cross-dataset evaluation of the frozen authored candidate.** IBM and heldout authored results were verified; IEEE compatibility was audited and the separate IEEE-specific model reproduced. Sparkov's three unsupported-input mappings fail to deliver useful high-threshold detection (online29/990 frauds,288 false alerts; card0/990). A separate unlabeled authored file produces2–5 high estimates but cannot establish accuracy. No retraining, cutoff tuning or promotion occurred. [Cross-dataset results and comparison CSV](docs/model-evaluations/candidate-cross-dataset-v1/report.md).

**Completed authored-adaptation experiment; keep V8 active.** Seven trained candidates and a separate card/online threshold policy were tested using customer-separated authored fitting, selection and evaluation. At a 90% cutoff, the selected candidate detects 26/30 reserved authored frauds with one false alert, versus V8's 7/30 and 54. However, primary IBM precision drops from 97.71% to 93.12% at the same cutoff, and an older-online diagnostic loses half its detections (20/36 to 10/36). The candidate remains offline after failing the native preservation gate. The frontend now highlights 90%+ probability estimates and provides a 90% cutoff preview without changing saved alerts. [Results and next step](docs/model-evaluations/authored-adaptation-v3/report.md).

**Completed probability-model training and integration.** The user's request for probabilistic analysis supersedes the display-only scale. Four learned probability outputs were fitted and selected through customer-grouped validation; the V8/card-specialist base weights and reference decisions remain frozen. New probabilities use their own mapped reference cutoffs and identify synthetic-source calibration. Results include Brier/log loss, class-specific RMSE and reliability groups. Evaluation is mixed and aggregate V8 error worsens; this is not an accuracy promotion or a general-upload reliability claim. [Evidence and implementation](docs/model-evaluations/probability-v1/report.md).

**Completed continuous-score integration.** Upload-v8 and card-pattern-v5 now expose raw margins and a versioned 0–100 evidence index for every eligible transaction, including nonalerts. The frontend presents scores, ranking metrics, CSV export, and a cutoff preview while preserving frozen reference decisions. No retraining was required. These indices are not calibrated probabilities and do not improve the underlying detection accuracy. [Specification and evaluation](docs/model-evaluations/continuous-scores-v1/report.md).

**Current decision: v8 is selected, integrated and frozen; the separate card-pattern reviewer is implemented.** The user's later selection supersedes the earlier recommendation to keep v8 offline. Do not change the v8 weights, thresholds or fraud metrics when working on review suggestions. The reviewer is a separate experimental investigation aid: 13 additional authored-scenario frauds and seven legitimate suggestions, but 216 legitimate suggestions and no additional fraud on the primary IBM test. It is not a promoted general fraud classifier. Results, retained assessments, demo access and model-version compatibility are implemented and tested. [Implementation and limitations](docs/model-evaluations/card-pattern-v1/report.md).

**Completed follow-up: preserve coverage and prioritize reviews.** `card-pattern-v5` keeps v1 leads and uses frozen v2 weights to prioritize six scenario frauds with zero legitimate purchases. Remaining leads stay visible; total recall and false suggestions are unchanged. V2 replacement, v3 filtering and v4 corroboration failed their gates and are not installed as filters. The next accuracy improvement requires stronger pattern support and independent evaluation. [Results and checks](docs/model-evaluations/card-pattern-v5/report.md).

**Completed recall-focused follow-up; no promotion.** Broader older IBM data raised training support to 2,518 frauds, but the selected model failed later calibration even under the tested higher missed-fraud costs. Card-pattern-v5 and frozen v8 remain active; no reserved or scenario results were used to retune the candidate. [Experiment and next evidence needed](docs/model-evaluations/card-pattern-v7/report.md).

The paragraphs below record the earlier decisions and completed modeling stages; the current engine is `engine-ml-upload-v8` / `assessment-v2.8`.

The requested **95% precision / 95% recall and broader-pattern study is complete**. Upload-v8 reaches 97.01% / 98.86% on the reused IBM longer-history test, but older online recall falls to 60.87%, scenario false alerts rise from 231 to 398, and unsupported Sparkov mappings also regress. Three online models and three frozen policies were evaluated; 268 confusion matrices were independently reproduced. Keep v7 installed and v8 offline. Further work needs separately defined development data for online/card patterns and independent evaluation, not retuning against these recorded results. [Experiment and next direction](docs/model-evaluations/upload-v8/report.md).

**Upload-v7 / balanced is installed.** The broader coverage/geography experiment is complete: five pilots, two full fits, separate calibration, a frozen reserved evaluation and app integration. On 334,777 reserved synthetic transactions with longer histories, it improves precision from 86.57% to 92.86% and recall from 88.21% to 98.86%, detecting 260/263 frauds with 20 false alerts versus 232/36. Its customer-bootstrap paired improvement interval is positive. [Full evidence and limits](docs/ml.md#installed-engine-upload-v7-geography-and-history-coverage-2026-10-25).

The 90%/90% point target is met for that declared longer-history population. Short-upload precision remains 85.22%, and the separate scenario-labeled 10,000-row file remains unchanged at 15.69% precision / 23.89% recall. The source is synthetic; primary final customers largely have earlier fitting history. This is not external validation or a universal reliability claim. The next research priorities are short-history false alerts and online/transfer coverage under a separate protocol. No post-final threshold tuning is authorized by these results.

The app now uses `engine-ml-upload-v7` and `assessment-v2.7`. All six sample metrics are refreshed; CSV bytes and source labels are preserved. Historical V13 and Upload-v5 results remain readable. The earlier Upload-v6 rescue cycle is retained offline because its improvement was insignificant. Prior reports remain immutable evidence of their own experiments.

The user reopened model improvement after the sample audit found a substantial benchmark-to-upload performance gap. The [upload-consistent research cycle](docs/ml.md#upload-consistent-retraining-completed-not-promoted-2026-10-25) is complete: 20 pilot fits, three fully trained channel specialists, separate calibration and a reserved customer/time evaluation. The 90% precision / 90% recall target was not met. The primary candidate reaches 31.84% precision / 85% recall, versus V13's 70.07% / 48% on the same reserved uploads; it is not promoted. Models, thresholds, failures and sample diagnostics are retained. That earlier candidate was not installed. Keep **IEEE-CIS as separate offline benchmark evidence**.

RiskFlow is a personal portfolio project using publicly available and authored data. Visitors will often upload arbitrary or AI-generated CSVs. Success means a polished, reproducible investigation experience with accurate claims about model performance; general fraud accuracy on arbitrary uploads is not a release requirement.

The user approved this direction and then authorized implementation of at least five IBM-based CSV examples and their frontend integration. The six-sample library is implemented; the guided interactive tutorial remains a separate follow-up. Public deployment is a separate task.

This is the single active roadmap. It supersedes the old learned-engine and general-behavioral proposals and conflicting research priorities in the original project specification. Historical reports, evaluation protocols and manifests remain records of their original experiments. Their past instructions to preserve personal plans do not prevent this explicitly requested planning update.

## Existing foundation

Completed research: removed unavailable feedback, reproduced file-local histories, trained channel specialists, and evaluated a causal score-history ensemble. Showcase users are excluded. Results and hashes are frozen. Further model work should protect first-fraud and swipe detection, use multiple customer/time validation folds, and check outcome-support counts before fitting. A reserved population without fraud cannot establish recall. Do not tune against these recorded outcomes and describe them as fresh validation. The original benchmark headline cannot substitute for upload evaluation.

- Upload-v8 is integrated as `engine-ml-upload-v8` / `assessment-v2.8`, with a hash-checked bundle under `backend/model_artifacts/upload-v8/` and the pinned V13 online dependency under `backend/model_artifacts/v13/`. The deterministic point-scoring engine is retired.
- Temporary imports currently default to graph investigation; retained datasets default to behavioral observations. Explicit Upload-v8 simulation supports compatible inputs.
- Saved datasets, immutable assessments, graph investigation, playback, evidence and input validation already exist. Reuse them.
- Authored scenarios and example CSVs demonstrate interactions. Their story labels do not establish fraud-detection performance.
- IEEE training and chronological evaluation are complete and remain offline.
- Prior portable and multi-source models failed their promotion gates. Those research results are useful evidence of engineering judgment, not unfinished requirements.

Current behavior and evidence: [README](README.md), [ML guide](docs/ml.md), [V13 strategy audit](docs/model-evaluations/strategy-v1/report.md), [IEEE report](docs/model-evaluations/ieee-v1/report.md).

## Intended visitor experience

| Entry | Experience | Claim |
| --- | --- | --- |
| Try the demo | Explicitly load a bounded Upload-v8 example, run or replay the supported analysis, investigate alerts and inspect outcomes where available | Demonstrates Upload-v8 and the investigation workflow on a named example |
| Upload a CSV | Preview inputs, choose experimental Upload-v8 predictions when supported, or use behavioral observations / graph investigation | Upload performance is unvalidated; missing inputs and unsupported rows remain visible |
| Model evidence | Read benchmark results, denominators, missed fraud, false alerts, provenance and reproduction references | Results apply to the named model, population, inputs and policy |

Make Try the demo prominent in the empty workspace. Keep startup and refresh empty until the visitor chooses an action; do not silently load a saved dataset. Reuse existing navigation and dialogs rather than build a new onboarding system or dashboard.

## M1. Establish demo provenance and replay feasibility

Status: complete for the curated IBM sample library. Six examples from 5 to 10,000 rows run through live Upload-v8, with source/model hashes, source-row lineage and their own measured results. Selection is explicitly curated from previously inspected data, not a new holdout. Bounded source subsets are packaged with attribution; the full source remains local. See the [implementation record](docs/sample-library/README.md).

Deliver a compact demo manifest and preparation/reproduction instructions.

- Inventory existing Upload-v8 fixtures, frozen predictions, usable source history and source-use terms. Prefer existing assets and dependencies.
- Distinguish **authored workflow examples**, **live Upload-v8 predictions** and **recorded benchmark replay**. Do not present cached benchmark decisions as a new live model run.
- Prefer a bounded chronological sample selected by a documented, outcome-independent rule from an existing evaluation population excluded from fitting where the retained records can establish that exclusion. Record its source, date range, selection rule, necessary prior history, model/policy hashes and outcome provenance.
- Prior evaluation populations have been repeatedly inspected. A subset is a demonstration of existing evidence, not a new independent test. Do not assert training exclusion if retained evidence cannot establish it.
- Run the sample through the actual upload/runtime path. Compute its own confusion counts from separate outcomes. Short history and absent merchant-fraud feedback can change predictions; the published IBM headline cannot be attached automatically to this sample.
- If faithful source replay or source redistribution is unsupported, use the existing authored Upload-v8 examples for the interactive demo and show aggregate benchmark evidence separately. Do not reconstruct missing features or historical fitting records. Public packaging must not automatically include raw research data.
- Include a compact, explicitly curated case walkthrough for caught fraud, false alerts and missed fraud when verified cases are available. Curated case selection must not supply aggregate performance estimates.

Acceptance: every demo asset has an explicit provenance and result type; displayed predictions are reproducible; any numerical performance claim belongs to its actual evaluation population. The fallback above keeps this milestone bounded and avoids reopening model research.

## M2. Make the Upload-v8 demonstration easy to discover and investigate

Status: sample discovery and loading are implemented through the empty-workspace entry, toolbar and import panel. The static canvas checklist is removed. Samples reuse existing live simulation, Events and Results. A dedicated interactive tutorial and richer guided outcome walkthrough remain deferred to a follow-up.

Deliver the main portfolio journey using the existing simulator, graph and evidence panels.

- Add a clear Try the demo entry, a short explanation of the synthetic purchase setting, and a path from an alert to its supporting transactions.
- Offer outcome reveal/comparison only for examples with separate labels. Distinguish predictions from known outcomes and authored scenario annotations.
- Show the measured review workload and failure cases alongside successes. No alert means the model did not flag the transaction, not that the transaction is safe.
- Preserve Upload-v8's frozen decisions, feature contract and raw thresholds. Use the trained, versioned probability output for each route and identify its mapped reference cutoff. Do not average unrelated specialist estimates or present them as calibrated for arbitrary uploads.
- Distinguish historical observations from model explanations. Shared devices, graph layout and scenario titles must not be presented as prediction drivers when Upload-v8 does not use them.
- Keep the default walkthrough short enough for a visitor to understand the purpose, run analysis and inspect one result in roughly 90 seconds. This is a design target, not a measured analyst-efficiency claim.

Acceptance: the visitor can complete the walkthrough without preparing a CSV or understanding model internals; replay and live inference are clearly identified; supporting evidence is navigable.

## M3. Make arbitrary uploads useful and explicit

Deliver concise mode descriptions and consistent result labels through existing import and assessment flows.

- Keep graph investigation and behavioral observations available with their existing input requirements.
- Offer Upload-v8 predictions explicitly when its strict purchase-input contract is satisfied. Do not add a new estimator or silently change the selected mode.
- Preserve USD, timestamp, account, amount, merchant, MCC and channel requirements for Upload-v8. Input compatibility permits an experiment; it does not establish domain validity.
- Never fabricate required values to make an upload score. Existing documented source adapters and user-declared assumptions stay visible.
- Show one short scope notice beside the prediction summary, with details available on demand. Avoid repeated popups or warning-heavy onboarding.
- When labels are supplied, show metrics for this upload only, with label provenance and scored/unscored coverage. AI-authored labels are scenario annotations, not verified bank outcomes. Unknown outcomes must not become negatives.
- Unsupported inputs explain what is missing and offer a useful supported mode. An inference failure is an error, never a low-risk result.

Suggested prediction notice:

> Experimental predictions: Upload-v8 was evaluated on synthetic purchase data. Performance on your upload has not been established. Alerts identify transactions for review.

Acceptance: compatible unlabeled uploads produce clearly scoped experimental results; labeled uploads use their own outcomes; incomplete inputs produce actionable guidance without invented predictions.

## M4. Present model evidence with matching context

Deliver a compact Model evidence view using existing reports and verified aggregate results.

- Lead with precision, recall, false alerts, missed fraud, evaluated population and policy. Accuracy alone is not the headline.
- Separate the synthetic Upload-v8 benchmark, live-demo results, authored examples and real-data IEEE benchmark. Never transfer a statistic between them.
- Retain the model-evaluation limits: reused synthetic populations, limited channel/first-fraud support and no positive fraud outcomes in the reserved 2020 population.
- Include the supplied 10,000-row diagnostic as an accessible transfer limitation rather than hiding its weaker result.
- Explain IEEE's daily review-budget results separately from Upload-v8's fixed alert policy. They are different tasks and populations, not a model leaderboard.
- Link detailed reports for dates, input assumptions, calibration scope, reproduction and uncertainty. Prefer existing static aggregates; do not deploy IEEE inference or distribute its raw rows.
- Use restrained portfolio language: "Interactive fraud investigation with a frozen model, reproducible benchmarks and transparent limitations." Do not claim production effectiveness or universal upload accuracy.

Acceptance: every number traces to a report or reproducible demo calculation; missing outcomes never produce accuracy metrics; model boundaries are visible without overwhelming the walkthrough.

## M5. Verify the complete journey and finish portfolio documentation

- Exercise Try the demo, outcome reveal, graph/evidence navigation, compatible unlabeled upload, labeled upload, missing-field handling, saved assessment reopening and refresh behavior.
- Verify that changing or removing outcome labels does not change predictions. Check deterministic replay and model-bundle integrity if inference paths or packaging change.
- Verify displayed confusion counts independently and distinguish labels from predictions. Preserve unsupported fraud in coverage reporting where outcomes exist.
- Run relevant backend/frontend tests, strict typing, lint and build for changed code, plus targeted browser checks for changed journeys. Update generated contracts only when API schemas change.
- Update README with the default demo path, supported uploads, concise scope, screenshot or short walkthrough, and evidence links. Review responsive layout and keyboard access in touched screens.
- Keep historical reports and known failures accessible. Record actual validation and remaining limitations when implementation finishes.

Done for the showcase milestones means the walkthrough works, uploads have honest and useful outcomes, displayed claims match their evidence, and applicable checks pass. The reopened model experiment has its own performance target and promotion decision; it must report measured results even if that target is not achieved.

## Deferred work

- Cross-source dataset pooling, Xente acquisition and broad generalization searches. The explicitly authorized IBM upload-model experiment is active work.
- Live IEEE upload/scoring integration, new graph-learning models and new fraud-probability calibration.
- Transfer/AML detection, payment blocking, streaming and bank integrations.
- Persistent analyst dispositions, operational monitoring and measured analyst productivity studies.
- Sounds, decorative animations and dropdown polish unless needed for the main journey.
- Hosting and Docker deployment verification; these can be planned after the local showcase is complete.

## Continuing implementation constraints

- Preserve temporary imports, explicit saved-dataset opening, namespaced identities, conservative deduplication, atomic imports, append-only corrections and immutable assessments.
- Preserve existing graph interactions, object scope, playback, undo, accessibility and captured runs. Do not reopen settled theme decisions.
- Keep strictly prior history, same-time batching, date-only semantics and outcome separation. Do not infer customer location from merchant geography or transfers from shared objects.
- Preserve the frozen V13 bundle, original datasets and historical experiment evidence. Historical manifests retain their original hashes even when current planning documents change.
- Prefer focused changes and existing components. Remove dead or redundant touched code; independent evaluation calculators are intentional. Do not introduce unnecessary handwritten code comments.
- Keep tests that detect plausible failures; use independent expected values for important invariants. Documentation-only changes need link/content checks, not application test runs.
- Windows tooling: `backend/.venv/Scripts/python.exe`; load `scripts/Use-ProjectTools.ps1` and use `npm.cmd`. Use repository configurations and isolated browser-test databases. Verify process ownership before stopping servers.

Update this roadmap as milestones finish rather than accumulating obsolete proposals.
