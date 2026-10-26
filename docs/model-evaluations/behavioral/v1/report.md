# Portable behavioral engine implementation and evaluation

Implemented on 2026-10-24, America/New_York, under the user's implementation authorization. The shared causal feature engine and retained **Behavioral observations** mode are available. Offline model development and the frozen Handbook/IBM evaluations are complete. No portable fraud model was promoted: the synthetic improvement does not survive the required generalization and missing-history checks. V13 artifacts and scoring remain unchanged.

## Application behavior

In **Datasets**, select **Behavioral observations · no fraud score**, then **Describe purchase history**. Positive outgoing USD purchases with account identity and usable time receive prior observation counts, a prior median, amount-to-median comparison and links to contributing records. Merchant, MCC, channel and completion status are optional. Date-only observations become history the following day. Counts describe observed purchases, not completed spending. No risk score, fraud probability, alert or payment decision is invented.

The import format panel accepts explicit declarations for missing USD currency, single-account identity, purchase type and outgoing direction. Source values take precedence. Transaction IDs are still required. Nothing assigns an account, currency, activity type or completion status without source evidence or the user's declaration. `TransactionAmt` is an amount alias; relative `TransactionDT` and card attributes are not mapped to calendar time or account identity.

Unsupported records remain visible with reasons. Refunds, reversals, captures and status updates do not become new observed purchases. Account/source/unit histories are separate. Merchant descriptions are not treated as authoritative merchant IDs. Non-USD retained amounts, unsupported activity and date clocks that cannot be represented by the supported day boundary are explicitly unavailable for this mode.

Saved results use `assessment-behavioral-v1`, `behavioral-features-v1` and `behavioral-routing-v1`. They retain the source revision, analysis hash, evidence and analysis mode. Reassessment creates another result; reopening uses captured values. The capabilities endpoint and strict frontend decoder reject unsupported backend versions, fabricated score fields, invalid support counts, cross-account evidence and future evidence. New import previews use normalizer version 5; older pending previews must be regenerated.

The existing V13 simulator, temporary CSV import, graph behavior and old saved assessments retain their semantics. Behavioral observations are currently a retained-dataset workflow, without a new simulation/replay mode. The authored [example CSV](../../../../fixtures/runtime/behavioral-observations.csv) contains no fraud labels.

## Data and protocol

All 183 local Handbook pickle files match official repository Git blob identities at tree `6e67dbd0a3bfe0d7ec33abc4bce5f37cd4ff0d6a`. Only these verified local files are deserialized offline; the application accepts no pickle uploads. No dataset license was found in that repository, so raw or derived source records were not redistributed. The Handbook's synthetic units are retained as `HANDBOOK_SYNTHETIC`, not asserted to be USD. Its synthetic clock supports elapsed-time calculations without inventing a real timezone.

The source has 1,754,155 records and 4,990 observed customers. Forty-two nonpositive amounts remain unscored and are excluded from purchase history. The initial preparation stopped on such an amount before fitting; its partial cache remains intact. The corrected cache uses a new directory. See [the correction record](preparation-correction.json) and [data quality](data-quality.json).

| Partition | Dates, 2018 | Source records | Eligible development records |
| --- | --- | ---: | ---: |
| Warm-up | April 1–30 | 288,062 | 230,622 |
| Fit | May 1–July 29 | 862,308 | 690,514 |
| Model selection | July 30–August 13 | 143,844 | 115,497 |
| Threshold selection | August 14–28 | 143,744 | 115,316 |
| Final | August 29–September 30 | 316,197 | Not fitted |

A fixed customer hash reserves approximately 20% of customers from fitting and development outcome access. Their earlier unlabelled history is permitted. Final results distinguish future activity of fitted customers from held-out customers. This is not an entity-disjoint merchant experiment.

Targets and stored scenario assignments never enter feature functions. Development outcomes are separate sidecars; training rejects the final role. Final source pickles necessarily materialize all their columns during trusted deserialization, but preparation drops final targets without inspecting or exporting their values. This is logical separation, not an operating-system access boundary. All six final prediction tables were hashed before joining final outcomes. The final cohort is now consumed.

The IBM source was already exposed by earlier project experiments. Its original CSV and newly supplied archive have separate hashes; record-level independence is not asserted. The existing CSV supplies a fixed diagnostic population: users 0–199, January–September 2018, January–February warm-up and March–September evaluation. User+Card identifies instruments; USD and a UTC convention retain the existing adapter assumptions. The archive is not used as a fresh holdout. IEEE-CIS remains a separate, deferred experiment and supplies no portable predictors.

The IBM diagnostic labels were opened after every estimator and threshold was frozen, while the remaining Handbook degradation caches completed. This differs from the proposed order of reporting Handbook first. Neither estimator, feature selection nor threshold was retuned afterwards. See [execution and access-order record](execution.json).

## Features and fitting

`app/domain/features/behavioral.py` is shared by offline extraction and retained analysis. It maintains bounded 30-day observed-purchase state, shorter count windows, amount summaries and optional merchant state. Every equal-time batch reads the same strictly prior state. Date-only rows have next-day availability and no subhour feature. Late batches, duplicate active identities, invalid money and state-budget overflow fail explicitly. Amount parsing uses Decimal; float32 feature caches do not replace source money.

Core inputs include log amount, count/span/age, cold-start and date indicators, 1h/24h/7d counts, prior mean/median, amount ratio/percentile, robust deviation and short/long activity ratios. Enriched inputs add prior merchant visits/frequency/recency and causal seven-day merchant population counts. IDs are grouping and joining keys, never predictors. No labels, scenario annotations, final status, geography guesses, merchant fraud feedback or arbitrary context dictionaries are model inputs.

The search compared regularized logistic regression and CatBoost for amount-only, core, enriched and separately recomputed date-only inputs. Each family received two predeclared configurations; finalists were repeated on three seeds. All training negatives were retained. Model selection and operating-threshold selection used different chronological periods. Preprocessing belongs to each persisted estimator. There was no post-threshold refit or probability-calibration claim. Model outputs are raw margins.

Six input conditions were recomputed before features: full input, absent merchant column, deterministic row-level merchant masking, merchant absence by customer, date-only time and complete history removal. Core features are invariant to merchant degradation. Merchant masking was evaluated as a stress test of the trained enriched model, not a claim that a dedicated missingness-trained enriched estimator was released. Single-account cross-merchant population support is not validated for the enriched model.

## Frozen Handbook results

The final population has 316,197 records and 2,824 synthetic fraud labels. Nine zero-value records are unscored; none carries a fraud label. Metrics retain them in end-to-end denominators. Selection seed: 20261024. Thresholds were frozen on the separate threshold period.

| Method | Precision | Recall | F1 | Alerts |
| --- | ---: | ---: | ---: | ---: |
| No alert | Undefined | 0% | 0% | 0 |
| Amount threshold / selected amount-only logistic | 99.83% | 20.89% | 34.55% | 591 |
| Development-selected causal rule | 69.60% | 26.03% | 37.89% | 1,056 |
| Core logistic | 75.97% | 25.74% | 38.46% | 957 |
| Selected core CatBoost | 88.40% | 30.49% | 45.34% | 974 |
| Enriched CatBoost | 90.77% | 29.96% | 45.05% | 932 |

The predeclared primary comparison is core versus the selected history-free amount model. F1 increased by **10.79 percentage points**. Paired 95% intervals are **+7.13 to +14.42 points** under whole-customer resampling and **+8.52 to +13.47 points** under circular seven-day blocks, with 1,000 defined replicates each. This passes the frozen synthetic comparison gate. It does not establish an advantage over V13 on its specialist domain or over arbitrary production systems.

Core recall is 28.41% on future fitted-customer activity and 37.52% on held-out-customer activity. At top min(100, eligible transactions) per day, it reviews 3,300 transactions and detects 946 of 2,824 frauds: 28.67% precision and 33.50% recall. Ties are label-independent by event ID. This is a transaction budget, not an account-day queue or a staffing recommendation.

Stored-scenario recall exposes the limitation: scenario 1 is 145/157 (92.36%), scenario 2 is **1/1,822 (0.055%)**, and scenario 3 is 715/845 (84.62%). Scenario assignments can overwrite overlapping generator mechanisms; these are breakdowns of the stored annotations, not disjoint causal explanations. The compromised-terminal mechanism remains effectively undetected without informative behavioral evidence.

Core F1 stays 45.34% under each merchant degradation, as expected from its inputs. The separately trained date-only model reaches 45.17%. With all prior history removed, core F1 is **0%**. The 44 naturally history-free final records contain no fraud, so they cannot validate cold-start detection. No weak amount-only fraud fallback was added to the application. Merchant enrichment did not improve the core point estimate; no relationship-detection claim is made.

All estimators, seeds, period/identity/scenario segments, ranking metrics and stress tests are retained in [full results](results/results.json), with [paired uncertainty](results/primary-comparison.json). Comparisons other than the predeclared primary are descriptive.

## IBM transfer and promotion decision

The out-of-domain diagnostic has 98,256 records, 139 synthetic frauds and 95.43% supported positive-purchase coverage. Three frauds occur on excluded records and remain misses. Frozen core CatBoost detects 33 frauds but produces 10,323 alerts: **0.32% precision, 23.74% recall and 0.63% F1**. The selected amount-only logistic model has 1.08% F1. Neither model is suitable for ordinary-upload promotion on this evidence. See [diagnostic results](ibm-results/results.json).

No portable inference artifact is installed in the runtime artifact directory. Research models, all candidates, thresholds and digests remain in `training_data/ml-general/artifacts/v1/`; the application loads only its existing controlled V13 bundle. Descriptive observations are explicitly identified and do not silently substitute for failed model inference. V13 manifest SHA-256 remains `62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046`.

## Verification and resource observations

- Backend: 221 tests passed; Ruff clean; strict mypy clean across 73 source files.
- Frontend: 216 tests passed; typecheck, ESLint, formatting and production build passed.
- Browser: the new descriptive import/evidence/reopen journey and all three existing retained-history tests passed. The descriptive journey passed again after stricter evidence decoding. Windows server teardown hung; only verified test servers on 8123/5184 were stopped, after tests had passed.
- Independent fixtures cover arithmetic, future perturbation, equal-time/date-only permutation, source/account/unit isolation, missing merchant history, delayed availability, lifecycle exclusions, unknown labels, daily budgets, artifact preprocessing and immutable reopen. Current shared feature code exactly reproduces 28,818 cached development rows at float32 precision.
- Largest recorded full feature-preparation peak: 853,045,248 bytes; enriched fitting peak: 1,002,319,872 bytes. Training uses two threads and no GPU. Existing dependency versions are recorded in the protocol; none was installed for this change.
- The build still reports its bundle-size warning (715.91 kB minified / 209.63 kB gzip). Docker and deployment were not exercised.

## Reproduction and remaining boundaries

From the project root, set `PYTHONPATH` to the absolute `backend` path and use `backend/.venv/Scripts/python.exe -m ml.behavioral`. Commands are `freeze`, `prepare --condition <condition>`, `train --family <amount|core|enriched|date>`, `predict`, `evaluate`, `transfer-predict` and `transfer-evaluate`. `--help` lists directory arguments. Existing output directories are immutable: pass new report/cache/artifact/prediction/output directories for a new run. The current cache is `training_data/ml-general/cache/v1-complete`; the interrupted `cache/v1` is intentionally preserved. Reusing consumed final labels is reproduction, not another unseen evaluation.

For exact current predictions, use the frozen research estimators and threshold manifests. [Protocol](protocol.json), [source identities](sources.json), per-condition cache manifests, family search logs and selected-model manifests are retained beside this report. Raw/derived records and model binaries remain local under ignored `training_data`.

Implemented milestones cover trusted source preparation, portable causal features, bounded model comparisons, frozen evaluation and a supported descriptive retained workflow. Learned runtime packaging, fraud-score routing for ordinary uploads, richer temporary-import modes, validated single-account merchant models and model contribution displays are withheld because their evidence gates are not met. IEEE identity joins/source-specific training, broader non-USD money parsing, additional missingness-trained variants, forward inner-fold stability checks, arbitrary-history truncation experiments, an exported 10,000-row source demo and measured analyst-efficiency studies remain future work. They are not represented as completed or necessary to use the released descriptive mode. Protected `plan.md`, `todo.md` and `docs/RiskFlow_ML_Implementation_Plan.md` were not changed.

Source references: [official Handbook data](https://github.com/Fraud-Detection-Handbook/simulated-data-raw), [Handbook simulator specification](https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_3_GettingStarted/SimulatedDataset.html), and the project's [V13 evidence](../../../ml.md).
