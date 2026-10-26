# Machine learning and runtime inference

## Installed engine: Upload-v9 mixed-source (2026-10-25)

The user explicitly selected the evaluated authored-adaptation candidate for integration. New runs use `engine-ml-upload-v9`, `assessment-v2.9` and `fraud-probability-v2`, with the frozen card88.83% / online96.25% policy. The 90% highlight is independent of saved alert decisions. Packaged probabilities and flags match the recorded research outputs exactly. V8 and the card models remain immutable dependencies, and archived runs preserve their original identity. The failed statistical gate and cross-source regressions remain disclosed. [Integration, exact sample metrics and checks](model-evaluations/upload-v9-integration/report.md). Earlier sections below describe the decisions at their evaluation dates.

## Cross-dataset candidate evaluation (2026-10-25)

The frozen authored candidate was checked on IBM, its customer-heldout authored slice, Sparkov assumption variants and a separate unlabeled authored source. IEEE cannot directly supply this model's required input semantics; the existing IEEE-specific model was reproduced separately and is clearly distinguished. Sparkov transfer remains poor despite improved ranking, while older IBM online recall regresses. No runtime model or threshold changed. [Results, compatibility boundaries and reproducible comparison](model-evaluations/candidate-cross-dataset-v1/report.md).

## Authored adaptation: evaluated, not installed (2026-10-25)

Seven mixed-source candidates were trained with customer-separated authored fitting and evaluation. At a 90% cutoff, the selected candidate finds 26/30 heldout authored frauds with one false alert (V8: 7/30, 54 false alerts). Primary IBM precision falls from 97.71% to 93.12% at the same cutoff; an older online diagnostic also drops from 20/36 detections to 10/36. It failed the native preservation gate and remains offline. The installed V8/card/probability packages are unchanged. The frontend adds 90%+ estimate highlights and a threshold preview. [Data separation, all results, and next step](model-evaluations/authored-adaptation-v3/report.md).

## Trained probability outputs (2026-10-25)

New runs use `fraud-probability-v1`: four probability output models trained on IBM data outside the base fitting rows. Customer-grouped validation selected sigmoid mappings over isotonic regression. V8's original trees and decisions remain unchanged; its card/online reference cutoffs now correspond to approximately 81.04%/75.93%, not 50%. The app shows probability losses, reliability groups, cutoff previews, and versioned exports. These are estimated probabilities with unverified calibration on custom uploads, not a demonstrated accuracy improvement: primary V8 RMSE changes from 0.60 to 0.76 and authored-scenario RMSE from 20.91 to 24.56. [Training, regressions, API specification and checks](model-evaluations/probability-v1/report.md). The earlier display-index work below describes historical results.

## Continuous score output (2026-10-25)

V8 and the card specialist now expose continuous scores in the API, payment details, and saved assessments. A versioned 0–100 evidence index accompanies each exact raw margin; 50 represents the existing cutoff and does not mean 50% fraud probability. Eligible card transactions receive specialist scores even below cutoff. Results include per-model ranking metrics, a threshold preview, and score CSV export. No retraining was needed, and the original model decisions remain unchanged. [Score specification, ranking results, and limitations](model-evaluations/continuous-scores-v1/report.md).

## Installed engine: frozen Upload-v8 plus separate card-pattern review (2026-10-25)

The user explicitly selected v8 after reviewing the tradeoffs below. **Upload-v8 / precision95 now powers the app.** Its weights and thresholds are unchanged. Production inference matches all 990,196 frozen native history-view predictions, and running the reviewer does not alter any v8 margins, decisions or fraud metrics. The main reused IBM result remains 97.01% precision / 98.86% recall; this is not general bank reliability.

The separately trained `card-pattern-v1` reviewer uses earlier domestic card fraud and relative behavior without absolute geography or raw MCC predictors. It suggests 9/26 counterfeit-swipe and 4/35 electronics cash-out cases in the supplied authored scenarios, plus seven legitimate purchases. It adds **216 legitimate reviews and zero additional frauds on the primary IBM test**. Validation is weak, so suggestions appear in a collapsed experimental panel and payment explanations, separate from v8 alerts. Saved assessments preserve the same evidence. The model metrics do not count these suggestions.

**Current reviewer package: `card-pattern-v5`.** It retains all v1 suggestions and adds the separately trained v2 priority model. The scenario priority group contains six frauds and zero legitimate purchases; seven frauds and seven legitimate purchases remain exploratory. None of the 216 primary IBM false suggestions is prioritized, but all remain in the total. Rejected replacements and calibration failures are preserved. [Current implementation and limits](model-evaluations/card-pattern-v5/report.md).

Try the authored card-review demo in Samples. All six original IBM sample files are unchanged and their model receipts now reflect v8. [Full implementation, training, evaluation and checks](model-evaluations/card-pattern-v1/report.md).

## Recall-focused card follow-up: not promoted

Four broader models and a cutoff baseline used 2,518 distinct fitting frauds, including 1,367 older swipe frauds. Selection was corrected to count only cases missed by both v8 and the installed reviewer. The best candidate added zero fraud detections and false suggestions on 113 distinct legitimate transactions at its selection cutoff on later calibration. No active cutoff was supported under the tested 5:1, 10:1 or 20:1 missed-fraud preferences and per-view review budget. Reserved customer and scenario evaluation remained unopened. Card-pattern-v5 stays installed. [Protocol, results and limits](model-evaluations/card-pattern-v7/report.md).

## Original offline experiment: Upload-v8 precision and transfer (2026-10-25)

At the end of this original experiment, v7 remained installed; the later user-selected integration is described above. Three new online specialists and three frozen operating policies were tested. The v8 precision candidate reaches **97.01% precision / 98.86% recall** on the existing 334,777-row IBM longer-history diagnostic, reducing false alerts from 20 to eight. Short-history recall remains 94.30%. On two older IBM online cohorts, recall falls from 69.57% to 60.87%; on the supplied scenarios, detections improve from 43 to 73 of 180 but false alerts rise from 231 to 398. Counterfeit swipe and electronics cash-out remain missed by the fraud classifier. A 100,000-row Sparkov sensitivity test also regresses under explicitly assumed missing fields; it is not native-source validation.

The main IBM test has no online fraud, and its precision confidence interval still extends below 95%. The 95/95 point target therefore does not justify a general reliability claim or replacing v7. All populations and limitations, pattern breakdowns, three trained candidates, thresholds and 268 independently verified confusion matrices are in the [v8 report](model-evaluations/upload-v8/report.md). No runtime or sample changes were made.

<a id="installed-engine-upload-v7-geography-and-history-coverage-2026-10-25"></a>

## Previous engine: Upload-v7 geography and history coverage (2026-10-25)

**Upload-v7 / balanced previously powered the app.** Five pilots and two full fits tested broader training, observable merchant geography, location transitions and different upload-history lengths. The frozen candidate passes the predeclared replacement criteria, with materially higher precision and recall than Upload-v5. It reaches the 90%/90% point target on the primary longer-history evaluation, but not on short uploads or arbitrary generated data.

| Population and history | Model | Precision | Recall | Caught | False alerts | Missed |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Reserved 334,777 rows, longer history | Upload-v5 | 86.57% | 88.21% | 232 | 36 | 31 |
| Same records and history | **Upload-v7** | **92.86%** | **98.86%** | **260** | **20** | **3** |
| Same source records, short history | Upload-v5 | 72.40% | 68.82% | 181 | 69 | 82 |
| Same short uploads | Upload-v7 | 85.22% | 94.30% | 248 | 43 | 15 |
| Exposed 160,321-row customer-held-out diagnostic, longer history | Upload-v5 | 89.57% | 78.03% | 103 | 12 | 29 |
| Same diagnostic uploads | Upload-v7 | 92.54% | 93.94% | 124 | 10 | 8 |

The primary population contains **263 distinct fraud transactions across 34 customers with fraud**. Rebuilding it with two history lengths does not create 526 independent fraud examples. The customer-bootstrap 95% interval for paired F1 gain is **+0.0466 to +0.1332**. Candidate precision and recall intervals are **86.24–96.81%** and **96.90–100%**, conditional on the fitted models and this source; the precision interval still crosses 90%. First-fraud timestamp detection within an account/upload improves from 23/38 to 38/38 for longer histories, and from 32/75 to 68/75 for short histories. These are retrospective groupings, not predictor inputs. [Final metrics and breakdowns](model-evaluations/upload-v7/final.json).

### What changed

Training expands from 561 to **836 distinct card frauds**, covering 2018H2 through 2019H1 in customer buckets 0/1. Each transaction is rebuilt under long and short upload histories. Wide chunks cycle through 1,000/5,000/10,000 rows; short chunks through 100/250/1,000, with complete resets between files. The median number of prior transactions drops from 58 to six in the short view. All showcase users are excluded.

New inputs include merchant state/city, time since previous activity/location, recent location changes and repetitions, and current completion status. They supplement the existing account/context features, frozen teacher margins and strictly prior score histories. Raw account/merchant IDs, labels, future events and confirmed-fraud feedback are not predictors. Current completion status is supplied by the uploaded transaction; this is retrospective investigation, not a pre-authorization model. Geography remains optional but materially affects prediction. The selected pilot's largest feature importance is merchant state, reinforcing the need to keep claims source-specific.

Five pilots compare expanded sequence training, added geography, dual-history training, greater depth and first-fraud weighting. The selected dual-history depth-eight model reaches 94.07% precision / 96.52% recall on long development uploads and 91.34% / 91.74% on short ones. Two 600-tree models with fixed seeds then train on **1,148,116 card observations**, representing the two views of 574,058 source card transactions. Separate calibration freezes the averaged-margin cutoff at **2.485474202331682**, producing 94.74% / 97.83% on long uploads and 91.40% / 92.39% on short uploads. No model or cutoff changes after final evaluation. [Protocol](model-evaluations/upload-v7/protocol.json), [pilot comparisons](model-evaluations/upload-v7/pilot.json), [frozen ensemble](model-evaluations/upload-v7/frozen.json).

### Evaluation scope and transfer limits

Teacher weights were fitted only through 2018H1. Selection uses Q3 2019 buckets 2/3; calibration uses Q3 bucket 4. These development customers are separate from new-model fitting. Primary final records are Q3/Q4 2019 buckets 0/1, newly reserved within the upload experiment family, but **615 of the 629 final customers have earlier fitting records**. Q3 overlaps development calendar dates; Q4 is later. The existing baseline policy was also previously calibrated with later data, so this is not a historical as-of deployment reconstruction. The diagnostic uses already inspected Q4 buckets 2/4, absent from new-model fitting. All data comes from the reused IBM synthetic source, not a new bank dataset. [Split audit](model-evaluations/upload-v7/split-audit.json).

The primary fraud support is overwhelmingly chip: 260 chip frauds, three swipe frauds and no online frauds. Online inference remains the pinned V13 policy. This experiment therefore does not establish 90%/90% online or swipe reliability. Short-history precision remains 85.22%, despite improving substantially.

On the separately supplied, scenario-labeled **10,000-row card-format file**, Upload-v7 and Upload-v5 are identical: **43/180 detections, 231 false alerts, 15.69% precision and 23.89% recall**. All alerts are online; the 61 card-channel scenario frauds remain undetected. The IBM improvement does not transfer to that authored distribution. No retuning was performed on it. [Transfer diagnostic](model-evaluations/upload-v7/transfer.json).

The unchanged curated IBM 10,000-row example moves from 105 to **108/123 detections with zero false alerts**; its recall is 87.80%, not 90%. The 1,000-row example catches 19/19 at zero false alerts. All six results remain demonstrations of their exact files. [Sample results](model-evaluations/upload-v7/showcase.json).

### Runtime, reproduction and verification

New results identify `engine-ml-upload-v7`, policy `upload-v7-balanced`, model `ml-upload-v7 / balanced`, and retained assessment `assessment-v2.7`. The checked bundle contains two teachers and two new native CatBoost models under `backend/model_artifacts/upload-v7/`, with the retained V13 online dependency. `ml/coverage_runtime.py` requires no research data; `ml/features/upload_context.py` builds the new observable inputs. Old V13 and Upload-v5 artifacts, captured results and decoders remain supported. Sample CSV bytes are unchanged; their active catalog and receipts now use Upload-v7. The local service on port 8000 reports the new engine.

Independent checks reproduce **96 confusion matrices**. Flipping all labels in the largest example leaves features unchanged; a freshly rebuilt prefix produces identical features, margins and decisions. Optimized baseline batching matches the original per-file runtime on all 326,442 development observations. All six packaged sample decisions match frozen research exactly. **317 backend tests and 222 frontend unit tests pass**, alongside lint, strict typing, frontend build and the production HTTP smoke test. Browser validation and installation details are recorded in the [installation receipt](sample-library/upload-v7/installation.json). The existing large-JavaScript-chunk build advisory remains. [Research verification](model-evaluations/upload-v7/verification.json).

From an isolated research copy, set `PYTHONPATH=backend`, then run `python -m ml.upload_coverage` with `prepare`, `pilot`, `train`, `evaluate`, `samples`; `features` resumes a completed extraction before freezing. Follow with `-m ml.upload_coverage_verification` and `-m ml.upload_coverage_transfer`. Preserve completed outputs. `scripts/package_upload_v7.py` refuses packaging unless replacement criteria pass. With the model installed, `scripts/refresh_upload_v7_samples.py` refreshes sample results using `PYTHONPATH=backend;.`. Further research should address short-history false alerts and online/transfer coverage using a new protocol; do not retune on these consumed final outcomes.

## Previous installation: Upload-v5 higher recall (2026-10-25)

The following section records the earlier Upload-v5 installation; Upload-v7 supersedes it above.

At the user's explicit request, **Upload-v5 / recall85 replaces V13 for new simulations and retained model assessments**. This is a portfolio-engine replacement despite the unmet research promotion gate; it does not change the scientific findings below or establish 90% precision and recall. No model was retrained and no threshold was retuned during integration.

The app identifies new runs as `engine-ml-upload-v5`, policy `upload-v5-recall85`, model `ml-upload-v5 / recall85`, and retained assessment `assessment-v2.6`. New retained requests use `analysisMode: "model"`; the legacy `"v13"` request value is accepted as an alias for the current model. Stored historical runs retain their recorded V13 or rule-engine identities and results. Behavioral observations and graph investigation retain their defaults.

The hash-checked `backend/model_artifacts/upload-v5/` bundle contains two native CatBoost teachers, two native CatBoost ensemble members and the frozen card threshold **0.5358651623838893**. Online decisions retain the pinned V13 dependency in `backend/model_artifacts/v13/`. Serving requires these packaged bundles, not `training_data/`, research reports or research-runner imports. The new bundle manifest SHA-256 is `8d6d5c8a9efddcd72f096b478240f6e7086004e92d2a6cfe62d5d712109da5ce`.

`backend/ml/upload_runtime.py` reconstructs the strictly prior score histories and matches the frozen research scores/decisions exactly. Missing/corrupt artifacts produce an unavailable error; they do not switch models. The frontend checks the new engine identity before scoring, decodes both current and historical model results, and displays the correct captured version. Current CSV sample results have been recomputed; original CSV hashes, source labels and V13 receipts are preserved. The 10,000-row file now produces **105 detections, zero false alerts and 18 missed frauds** through the live app.

Integration checks: 290 backend tests, 221 frontend unit tests, 58 browser tests covering samples/model evidence/saved assessments/imports/replay/comparisons, strict typing, lint, frontend build and the production HTTP smoke test passed. The existing large-JavaScript-chunk build advisory remains. The local backend on port 8000 was restarted and reports the new engine. [Installation receipt](sample-library/upload-v5/installation.json), [active sample results](sample-library/upload-v5/catalog.json).

## Upload-v6 selective rescue: tested, not installed (2026-10-25)

The authorized follow-up is implemented in `backend/ml/upload_rescue.py`: three pilot fits, fixed swipe-routing and union comparisons, two full ensemble fits, separate cutoff calibration, frozen final evaluation and unchanged-sample diagnostics. **Upload-v5 remained installed after that cycle; Upload-v7 later superseded it above.** The selected rescue model gains recall but loses precision, and its paired improvement is uncertain. Neither the replacement criteria nor the 90%/90% target passed.

Both policies score the same **160,321 Q4 2019 transactions**, including 132 frauds across 21 customers with fraud, at natural prevalence.

| Policy | Precision | Recall | Caught | False alerts | Missed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Installed Upload-v5 / recall85 | 89.57% | 78.03% | 103 | 12 | 29 |
| Upload-v6 selective rescue | 89.08% | 80.30% | 106 | 13 | 26 |

First-fraud timestamp detection within each account/upload increases from **8/21 to 10/21**. The whole-customer bootstrap 95% interval for paired F1 improvement is **-0.0078 to +0.0341**, crossing zero. Candidate precision and recall intervals are 79.66–94.49% and 71.11–88.99%, conditional on these fitted models and reused data. These intervals do not account for all previous adaptive research. [Final results and breakdowns](model-evaluations/upload-v6/final.json).

### Training and selection

The rescue stage retains every installed alert. It adds a card alert only when both the older conservative teacher and a new learned gate flag it. Online decisions stay fixed. Three compact/full-context pilots compare ordinary and first-fraud-weighted training; replacement policies and fixed older-swipe routing are evaluated alongside rescue. Outcome-defined first-fraud positions affect fitting weights and retrospective diagnostics only, never inference features.

The selected depth-three, 16-feature pilot uses current sequence/teacher margins, prior score history and transaction context. It reaches **90.24% precision / 88.80% recall** in selection, versus installed Upload-v5's 91.23% / 83.20%. The larger-context pilot ties it; the earlier compact configuration wins the stable tie. Older-swipe routing and full replacement do not win. Two 400-tree models with fixed seeds are then fitted to all 142,476 eligible card fitting rows, including 275 frauds, and their margins are averaged. Separate calibration chooses cutoff **0.7259365239933818**, producing 86.36% / 82.61%, versus installed 89.74% / 76.09%. No model or cutoff changed after final evaluation. [Pilot comparisons](model-evaluations/upload-v6/pilot.json), [frozen models and cutoff](model-evaluations/upload-v6/frozen.json).

### Population and limits

Outcome support was inventoried before fitting. Fit uses Q2 2019 customer buckets 0/1, after Upload-v5 weight fitting ended in Q1. Selection uses Q3 bucket 3; calibration uses Q3 bucket 4. Fit customers are separate from all later splits; selection and calibration customers are separate. Final uses Q4 buckets 2/4; bucket 4 customers also have earlier calibration records. All showcase customers are excluded, and source rows do not overlap splits. Histories are reconstructed within each upload using only earlier events. [Protocol](model-evaluations/upload-v6/protocol.json), [split audit](model-evaluations/upload-v6/split-audit.json).

This is **reused IBM synthetic data**, not external validation. Q4 bucket 4 outcomes were inspected in earlier research. Q4 bucket 2 was not previously used in these upload experiments, but its 49 frauds are insufficient to establish the target independently; both models have identical 38 detections and seven false alerts there. All three recoveries occur in the exposed bucket. The baseline's policy was previously calibrated using Q4 bucket 3, so this is not a reconstruction of a model available historically at every fitting date. That bucket is excluded from final evaluation.

All final frauds occur in October. Online has zero positives; its eight false alerts cannot justify disabling that route or claiming online recall. Swipe has only 11 frauds. These small, dependent groups do not establish channel-wide reliability.

Upload history matters: the earlier Q4 diagnostic retained windows built from all of 2019; this protocol builds Q4-only windows across both final buckets. On the 79,374 shared rows, unchanged Upload-v5 changes 26 decisions, including 22 fraud decisions; net detections move from 67 to 65. This explains why earlier Q4 headline metrics differ. Both candidates use identical histories within this evaluation. [History sensitivity](model-evaluations/upload-v6/history-sensitivity.json).

The unchanged 10,000-row curated example improves from **105 to 106 detections**, still with zero false alerts. The 5,000-row example also gains one; the remaining four examples are unchanged. These overlapping demonstrations do not override the failed replacement criteria. At that point the sample catalog still described Upload-v5; the current catalog is Upload-v7. [Sample diagnostics](model-evaluations/upload-v6/showcase.json).

### Verification and continuation

**40 focused tests pass**, including existing runtime/sample parity and new rescue, routing, whole-score-tie calibration and first-fraud tests. Lint, formatting and strict typing pass. An independent scikit-learn calculation reproduces 30 confusion matrices; flipping every label in the 10,000-row CSV leaves features identical, and prefix scores/decisions match full-file results. Sample CSVs and frozen implementation hashes are preserved. [Verification receipt](model-evaluations/upload-v6/verification.json).

In an isolated research copy, set `PYTHONPATH=backend` and run `python -m ml.upload_rescue` with `prepare`, `pilot`, `train`, `evaluate`, then `samples`; `features` resumes completed extraction before freezing. Run `python -m ml.upload_rescue_verification` for independent checks. Completed protocols, selection and final results reject overwrites. Models and predictions remain under `training_data/upload-v6/`; serving imports none of this research code.

Next, expand fitting coverage across distinct historical fraud accounts and upload-history lengths, using several fraud-supported development folds. More cutoffs on this consumed final set would tune to known outcomes. Preserve these results when designing that separate experiment.

### Routes toward 90% precision and 90% recall

This agenda was recorded after the selective-rescue/routing cycle. Upload-v7 above subsequently completed the broader-coverage and history-length experiments. Current priorities are short-history precision and online/transfer coverage; the table preserves the earlier proposal context. These are not performance guarantees. The target applies to a declared IBM-compatible population at natural prevalence, not arbitrary AI-authored CSVs or real bank traffic. Use the installed frozen candidate as the comparison baseline.

| Priority | Experiment | Why it is worth testing | Main risk / validation requirement |
| --- | --- | --- | --- |
| 1 | **Selective rescue for the first suspicious transaction.** Combine the current sequence score with an event-focused model and the older conservative score. Train the gate on out-of-time predictions, using only current inputs and prior history support. Give first-fraud examples extra training weight; never use known-fraud history at inference. | The current higher-recall policy catches only five of ten first-fraud timestamps in the exposed diagnostic, while the older policy catches seven. The older conservative model has eight complementary fraud detections overall. | A simple union also adds five false alerts: the post-hoc union would have 75/83 detections but only 86.21% precision. A learned gate must reject unnecessary alerts without removing those recoveries. Test on separate customer/time folds, not this diagnostic. |
| 2 | **Channel-specific models and operating policies.** Keep the stronger chip sequence model; compare the older swipe specialist, a newly fitted swipe model and a pooled model. Revisit online separately only after establishing positive support. | The current diagnostic catches four of 11 swipe frauds versus the older model's six. The latest selection/calibration sets contained zero swipe or online fraud, so chip dominated model choice. | Small channel cohorts can produce unstable thresholds. Require fraud support per channel; report unsupported channel recall explicitly. Select the complete routed policy on pooled precision and recall as well as channel results. |
| 3 | **Expand fraud-pattern coverage within IBM.** Use additional historical fitting periods with fraud-supported accounts, preserve complete causal histories, and include short-history starts. Compare recent-only versus expanded data. | The latest card fit has 561 frauds, only 58 of them swipe. More distinct accounts and fraud episodes may teach patterns absent from the recent fit. | Older synthetic behavior may shift. Do not duplicate evaluation frauds into fitting, invent synthetic labels or rebalance evaluation prevalence. Split customers and time before sampling; measure gains across multiple periods. |
| 4 | **Targeted hard-example training or a small second-stage filter.** Mine out-of-time false alerts and missed frauds from development folds; compare a modest reweighting grid and a classifier trained on those difficult cases. | The current model already benefits from difficult-negative weighting, while the selective rescue adds a manageable set of ambiguous events. | Aggressive negative weighting/filtering can suppress fraud. Select the whole pipeline against simultaneous precision/recall constraints; do not optimize the filter in isolation. Keep all hard-example mining inside development. |
| 5 | **More stable model and threshold selection.** Compare candidates across rolling chronological, customer-separated folds and jointly calibrate channel thresholds on separate data. | Pilot 91.1%/91.5% fell to 85.7%/77.8% on a small calibration cohort. One lucky development period is insufficient. | Validation improves selection reliability, not necessarily separability. First check fraud counts/customer counts per period and channel; the 2020 cohort has no positives and cannot validate recall. |

The initial support audit, selective-rescue and fixed-routing comparisons are complete. Next, expand fitting coverage and history-length diversity using several fraud-supported development folds; a new swipe or online specialist still needs adequate positive support. Keep the app on the current frozen bundle until a replacement earns improvement on both objectives.

Before fitting, inventory outcome support only, reserve the evaluation population, exclude all showcase customers, and record the complete split/selection protocol. Preserve chronological teacher/stacker separation, customer separation and natural evaluation prevalence. Use separate selection and threshold-calibration folds. Report point precision/recall, confusion counts, channel/first-fraud performance and whole-customer uncertainty. The prior minimum of 100 frauds and 20 customers with fraud is a support floor, not a guarantee of narrow intervals. Reused IBM outcomes must remain labeled as reused; do not advertise them as untouched external validation.

On the exposed 83-fraud diagnostic, the current 67 detections/seven false alerts would need at least **75 detections and at most eight false alerts** to reach 90/90 at the minimum required detection count. This arithmetic illustrates the remaining gap; it is not permission to tune against those records. [Complementary-detection diagnostic](model-evaluations/upload-v5/proposal-overlap.json).

Method references: [scikit-learn grouped/time-aware validation](https://scikit-learn.org/stable/modules/cross_validation.html) explains why ordinary shuffled folds are unsuitable for dependent observations; [threshold tuning](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TunedThresholdClassifierCV.html) supports selecting an operating point on separate validation data; [CatBoost weighting parameters](https://catboost.ai/docs/en/references/training-parameters/common) document supported weighting controls. Threshold selection changes the precision/recall operating point; it does not by itself create new predictive information.

The [strategy revision](model-evaluations/strategy-v1/report.md) separates descriptive purchase history, graph investigation, and source-specific supervised benchmarks. Retained analysis defaults to behavioral observations; temporary CSV imports default to graphs without scoring. V13 is an explicit synthetic benchmark comparison. A matching schema does not validate an upload's domain, and no ordinary-upload fraud probability is available.

The separate [IEEE-CIS benchmark](model-evaluations/ieee-v1/report.md) uses chronological fitting, selection, calibration and final periods, preserving the original transaction/identity join and comparing matched basic features before adding anonymized provider fields. Its models remain offline. The public benchmark does not establish performance on arbitrary CSVs or availability of those features in a live payment system.

The historical research benchmark is **v13 / depth6**. Its full latest-cohort result is 98.86% precision, 79.09% recall, 99.9537% accuracy and 87.88% F1: 87 true positives, one false positive and 23 missed frauds. This is repeatedly exposed synthetic IBM history, not independent confirmation. The earlier application used `engine-ml-v13` and `assessment-v2.5`; those stored results remain readable. The active engine is described above. The deterministic scoring engine is retired. Historical experiment sections below retain their original evaluation-time decisions.

V14 tested six chronological combiner, sequence-feature and chip-specialist policies. None improved on v13 or achieved 90% recall with 97% precision. Across three periods, v13 achieved 96.50% precision / 75.39% recall; the sequence combiner achieved 95.48% / 57.81%. It recovered 11 frauds but lost 56 detections. Recent fitting windows had no online-fraud examples, and the stacking split shortened base-model fitting history. See the [complete findings](simulator-evaluation/ml-v14/report.md) and [decision record](decisions.md).

## Upload-v5 sequence refinement: fewer false alerts, recall not confirmed (2026-10-25)

Upload-v5 adds strictly prior model-score histories and trains a two-seed ensemble. It reduces false alerts on the reserved population and improves the largest curated example, but **does not establish 90% precision and 90% recall**. The reserved January-February 2020 population unexpectedly contains **no labeled fraud**. Native source outcomes were checked independently: all 188,356 eligible rows are `No`. Recall and a fraud-detection promotion decision cannot be estimated from this population. The candidate was initially retained offline; the user subsequently requested the explicit replacement documented above, without changing this evaluation result.

### Reserved evaluation: false alerts only

The frozen comparison covers 188,356 legitimate transactions from 1,143 customers in 155 upload windows. No model, threshold or example changed after this evaluation.

| Model / policy | False alerts | False alerts per 10,000 legitimate transactions |
| --- | ---: | ---: |
| Installed V13 | 25 | 1.327 |
| Upload-v4 primary | 21 | 1.115 |
| Upload-v4 higher recall | 57 | 3.026 |
| Upload-v5 primary | 10 | 0.531 |
| Upload-v5 higher recall | 14 | 0.743 |

The primary policy produces 52.38% fewer false alerts than upload-v4's primary policy. Eight of its ten false alerts come from the unchanged V13 online route. Its whole-customer bootstrap 95% interval is 0.216-0.892 false alerts per 10,000 legitimate transactions; the paired difference versus upload-v4 primary is -0.961 to -0.263 per 10,000. These conditional intervals concern false alerts only. Precision is zero for the emitted alerts because this population contains no fraud; recall and the planned F1-gain intervals are undefined. [Reserved results](model-evaluations/upload-v5/final.json), [false-alert uncertainty](model-evaluations/upload-v5/false-alert-uncertainty.json).

### Secondary labeled diagnostics

After completing the reserved evaluation, the frozen candidate was applied to the previously inspected upload-v4 customers in **2019Q4**: 79,374 transactions, 83 frauds and 13 customers with fraud. These customers are excluded from upload-v5 fitting, selection and calibration, but their outcomes were already exposed in earlier research. This is a retrospective diagnostic, **not replacement independent validation**. Original upload windows and earlier history are retained.

| Frozen model / policy | Precision | Recall | Caught | False alerts | Missed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Installed V13 | 84.85% | 33.73% | 28 | 5 | 55 |
| Upload-v4 primary | 87.30% | 66.27% | 55 | 8 | 28 |
| Upload-v5 primary | 90.48% | 68.67% | 57 | 6 | 26 |
| Upload-v4 higher recall | 76.92% | 84.34% | 70 | 21 | 13 |
| Upload-v5 higher recall | 90.54% | 80.72% | 67 | 7 | 16 |

The higher-recall comparison removes 14 false alerts while losing three detections. The primary point estimates improve both metrics, but the paired F1-gain interval versus upload-v4 primary spans zero (-0.0723 to +0.1134). The candidate's primary precision and recall intervals are wide: 77.08-97.78% and 50.00-84.29%. The diagnostic contains 72 chip frauds, only 11 swipe frauds and no online fraud. All frauds occur in October; the apparent three-month evaluation therefore has much narrower fraud coverage. [Diagnostic, channel/month/history breakdowns and conditional uncertainty](model-evaluations/upload-v5/exposed-2019q4.json).

The sequence model is weaker at the first fraud timestamp within an account's original upload window. Of ten such frauds in this diagnostic, upload-v5 primary catches two and its higher-recall policy catches five; both upload-v4 policies catch seven. For the 73 subsequent frauds, upload-v5 higher recall catches 62 versus upload-v4's 63. Its higher-recall swipe route catches only four of 11 frauds, versus upload-v4's six, while chip improves precision from 79.01% to 94.03% and loses one detection (64 to 63 of 72). This grouping uses outcomes solely for retrospective error analysis; neither known fraud nor future scores enter prediction.

All six existing CSV examples were evaluated without regeneration. On the **10,000-row example**, upload-v5 higher recall catches **105 of 123 frauds with zero false alerts**, versus upload-v4's 100 with five false alerts: 100% observed precision and 85.37% recall. Upload-v5 primary catches 93 with zero false alerts. The 1,000-row example improves from 17 to 18 detections at zero false alerts under the higher-recall policies; the 250-row and 50-row examples do not improve under that comparison. Curated, overlapping examples are demonstrations and must not supply a universal accuracy claim. [All sample results](model-evaluations/upload-v5/showcase.json).

### Training and validation design

- The new card models fit **431,582 transactions and 561 frauds** from 2018H2 plus 2019Q1, customer buckets 0/1. The earlier upload-v4 teachers were fitted only through 2018H1. Their raw margins on new fitting transactions are therefore out of time; the second stage never trains on teacher in-sample predictions. Online keeps V13.
- Added current teacher margin and same-account summaries of earlier margins over 1 hour, 24 hours and 7 days. Histories reset per upload; equal-time transactions cannot influence each other. These are uncalibrated prediction scores, not observed fraud outcomes or probabilities.
- Compared four 250-tree pilots on 47,473 sampled fitting transactions: recent data alone, current teacher score, score history, and score history with extra difficult-negative weighting. Retained all fraud and the highest 1% legitimate teacher scores per card channel, sampled 10% of other legitimate transactions, and applied inverse inclusion weights. Fraud weight is 3; difficult-negative weight is 4 for the selected model.
- On 161,135 selection transactions from separate 2019Q2/Q3 customers, the respective precision/recall pairs were **79.17/80.28%, 81.02/82.16%, 90.74/92.02%, and 91.12/91.55%**. The predeclared rule selected the final pair. These selection results are optimistic development evidence, not final performance.
- Fit the selected configuration to all eligible card fitting rows with 500 trees and two fixed seeds; average the raw margins. Calibrate once on 81,285 separate-customer 2019Q4 transactions, including fixed online alerts in the objective. The primary calibration result is **85.71% precision / 77.78% recall**; the higher-recall diagnostic is **70.59% / 88.89%**. Calibration contains only 54 frauds across eight customers. Selection and calibration have no swipe or online fraud.
- No supported 90%-precision diagnostic cutoff exists. Its stored `None` means no learned card alerts; fixed online decisions remain. The `precision90` entry in machine-readable results is an unavailable target, not a successful 90%-precision policy.
- All showcase customers are excluded from every research split. Fitting customers are separate from all later splits. Final 2020 customers can have earlier selection/calibration records: this is a later-period test in a repeatedly used synthetic source, not external validation. [Protocol](model-evaluations/upload-v5/protocol.json), [split audit](model-evaluations/upload-v5/split-audit.json), [pilot results](model-evaluations/upload-v5/pilot.json), [frozen ensemble](model-evaluations/upload-v5/frozen.json).

Verification: **34 focused tests pass**, strict typing and lint pass for the new modules, and 48 confusion matrices were checked independently with scikit-learn. Flipping all outcome labels in the actual 10,000-row CSV leaves the complete adapter/features/ensemble outputs unchanged. Saved/reloaded models agree exactly. Frozen code, dependencies, installed V13 and all six sample CSV fingerprints are unchanged. [Verification receipt](model-evaluations/upload-v5/verification.json), [execution lineage](model-evaluations/upload-v5/execution-lineage.json).

Reproduction from an isolated research copy: set `PYTHONPATH=backend`, then run `backend/.venv/Scripts/python.exe -m ml.upload_sequences` with `prepare`, `pilot`, `train`, `evaluate`, and `samples`, in order. The exposed diagnostic is `-m ml.upload_sequence_diagnostics`. Preparation/final stages reject existing output; preserve completed evidence. Code lives in `backend/ml/upload_sequences.py`, `backend/ml/features/score_history.py` and `backend/ml/upload_sequence_diagnostics.py`.

The next useful research target is protecting first-fraud and swipe detection while retaining the sequence model's lower false-alert rate. Any further selection needs several fraud-supported customer/time folds and an explicitly scoped evaluation plan, with label-support counts checked before fitting. The now-inspected 2020 records cannot validate recall. Do not retune these frozen policies or silently substitute a curated sample for the failed validation gate.

## Upload-v4 refinement: improved, target still unmet (2026-10-25)

The follow-up substantially improves the precision–recall tradeoff on a reserved **2019** population. All models and operating policies were fixed before evaluating these records. The comparison covers 315,423 transactions, 449 frauds, 302 customers and 53 customers with fraud, divided into 159 separately processed upload windows. Windows share customers; they are not statistically independent observations.

| Frozen model / policy | Precision | Recall | Caught | False alerts | Missed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Installed V13 | 85.00% | 37.86% | 170 | 30 | 279 |
| Previous candidate, upload-v3 | 37.49% | 81.07% | 364 | 607 | 85 |
| Upload-v4, conservative primary policy | 86.80% | 65.92% | 296 | 45 | 153 |
| Upload-v4, higher-recall diagnostic | 69.39% | 81.29% | 365 | 161 | 84 |
| Upload-v4, stricter diagnostic | 91.57% | 53.23% | 239 | 22 | 210 |

The higher-recall policy preserves overall fraud capture while reducing false alerts **73.48%** versus upload-v3. The conservative primary policy improves both precision and recall over installed V13 on these same records. Its F1 is 0.7494, versus 0.5239 for V13 and 0.5127 for upload-v3. Paired whole-customer bootstrap 95% intervals for the primary F1 improvement are +0.1576 to +0.3001 over V13 and +0.1564 to +0.3222 over upload-v3. Primary precision and recall intervals are 80.89–91.53% and 60.94–70.53%, respectively. These intervals are conditional on the fitted models and do not capture all adaptive development uncertainty. [Final results and breakdowns](model-evaluations/upload-v4/final.json).

**No policy reaches 90% precision and 90% recall together.** The candidate is retained as a stronger research baseline; the application and sample catalog remain on V13. No deployment or automatic replacement occurred. The alternative thresholds were specified before final evaluation and remain descriptive operating choices, not a post-test retuning of the primary policy.

### What changed

- Added 2018H1 fitting transactions to the existing 2017 fitting population. The pooled chip/swipe training set has **858,853 transactions and 694 frauds**, compared with only 110 chip frauds in the previous recent-data fit. Online training still lacks recent positives, so no new online model is invented.
- Mined **2,853 difficult legitimate transactions** from the 2018H1 fitting rows only: the highest 1% of previous-model margins among legitimate transactions in each channel. The teacher's weights were fitted before 2018. Neither old final-test errors nor new final labels enter fitting.
- Compared four 250-tree pilots: recent-data training, extra hard-negative weighting, hard-negative plus fraud weighting, and personal-history-only features with hard-negative weighting. Pilots retain all fraud and mined negatives, sample 10% of other negatives, and apply inverse inclusion weights.
- The winning chip setup uses weight 4 for mined legitimate examples and weight 3 for fraud. Hard-negative weighting alone was not the winner. The pilot achieved 90.77% precision and 71.37% recall on the expanded selection population. The winning swipe setup uses the recent-data model without additional class weighting. Online retains V13 after comparing the fixed incumbents.
- Refit the two selected configurations on all eligible fitting rows, with 500 trees each. Use only upload-available predictors; no identity or merchant-fraud-feedback predictor is added. Saved/reloaded model margins match exactly.

Selection initially used 2018Q3 customers and contained only 18 swipe frauds. Before full training or final access, a documented amendment added unused 2018Q4 records from the same selection bucket. The same saved pilots were reranked; no new hyperparameters or pilot fits were introduced. The expanded selection population contains 160,964 rows, with 248 chip, 36 online and 20 swipe frauds. Fitting and calibration customers are separate. [Original protocol](model-evaluations/upload-v4/protocol.json), [selection amendment](model-evaluations/upload-v4/selection-extension-protocol.json), [all expanded pilot results](model-evaluations/upload-v4/extended-pilot.json).

Calibration uses 163,114 transactions from a separate customer bucket in 2018H2. For each selected learned component, the primary threshold maximizes recall at at least 90% observed precision pooled and in each quarter containing at least 20 frauds, with at least 20 pooled alerts. Unsupported replacements retain V13 explicitly. The two diagnostics use 95% calibration precision or maximum calibration precision at at least 85% recall. Fixed baseline components remain fixed, so these channel-level calibration targets do not guarantee pooled future precision. An unavailable diagnostic threshold is explicitly `None` and produces no learned-channel alerts. [Frozen models and policies](model-evaluations/upload-v4/frozen.json), [operating-point definitions](model-evaluations/upload-v4/operating-points.json).

### Remaining limitations

The 2019 records were reserved for this experiment, but the IBM source has been used in earlier research. These customers were held out of fitting; their earlier 2018 outcomes were already inspected. This is a new temporal evaluation within a reused synthetic source, not untouched external or real-world validation. The final set contains **no online fraud**, so online recall is not estimable. New models still use file-local histories and the same positive-purchase eligibility rules as the app.

The higher-recall policy changes which frauds are caught: chip recall falls from upload-v3's 89.43% to 83.05%, while swipe improves from zero to 64.29% (27 of 42 cases). Chip false alerts fall from 559 to 143. On the conservative policy, chip precision/recall are 90.88%/66.09%, and swipe precision/recall are 81.82%/64.29%. Quarterly conservative precision ranges from 77.78% to 92.47%; performance is not uniformly above 90%.

All showcase users remain excluded from fitting, selection, calibration and the reserved population. After final evaluation, the higher-recall policy catches **100 of 123 frauds with five false alerts** on the 10,000-row example: 95.24% precision and 81.30% recall. The conservative policy catches 88 with one false alert. These curated, overlapping, fraud-dense examples remain demonstrations, not the primary validation evidence. [Showcase operating points](model-evaluations/upload-v4/showcase-operating-points.json).

### Verification and reproduction

The new pipeline and existing runtime checks pass **25 focused tests**, strict typing and lint. Separate checks verify customer/date separation, unique source rows, raw-upload feature parity, outcome-label independence, native model serialization, artifact hashes, and all final confusion matrices using an independent scikit-learn calculation. V13's installed package is unchanged. [Verification](model-evaluations/upload-v4/verification.json), [split checks](model-evaluations/upload-v4/split-checks.json), [raw parity](model-evaluations/upload-v4/raw-parity.json).

The maintained runner is `backend/ml/upload_refinement.py`. From the root, set `PYTHONPATH=backend`, then run `backend/.venv/Scripts/python.exe -m ml.upload_refinement` with `prepare`, `pilot`, `extend-selection`, `train`, `evaluate`, and `samples`, in that order. It reuses the preserved upload-v1 fitting cache and frozen upload-v3 teacher/incumbent. Outputs are under `training_data/upload-v4/` and `docs/model-evaluations/upload-v4/`. Preparation, frozen training and final evaluation reject existing outputs; rerun in an isolated research copy. Preserve the completed final evidence and reserve another evaluation population before tuning further.

## Upload-consistent retraining: completed, not promoted (2026-10-25)

The sample audit found that V13's historical merchant-fraud feedback is unavailable in the app. This follow-up rebuilt features from original IBM rows with the **same feature builder used for uploads**, zero feedback, strictly prior history, and a state reset for each simulated file. It tested 20 pilot fits and trained three selected channel specialists. The result does **not** meet the target of 90% precision and 90% recall, and the application still uses V13.

On the reserved 160,290 transactions from 292 customers in July–December 2018, there were 200 labeled frauds from 27 customers:

| Frozen policy | Precision | Recall | Caught | False alerts | Missed |
| --- | ---: | ---: | ---: | ---: | ---: |
| V13, identical upload conditions | 70.07% | 48.00% | 96 | 41 | 104 |
| New specialists, primary joint thresholds | 31.84% | 85.00% | 170 | 364 | 30 |
| New specialists, individual balanced thresholds | 36.85% | 78.50% | 157 | 269 | 43 |
| New specialists, thresholds targeting 90% calibration precision | 66.85% | 61.50% | 123 | 61 | 77 |
| New specialists, thresholds targeting 95% calibration precision | 78.45% | 45.50% | 91 | 25 | 109 |

All policies were fixed before final evaluation. The alternatives describe the tradeoff; they were not selected after seeing final results or installed in the app. A calibration precision target is not a guarantee of future precision. The primary candidate's customer-bootstrap 95% intervals are 20.74–44.06% precision and 70.77–95.81% recall. Its paired F1 difference versus V13 has interval −0.2611 to +0.0458, so there is no demonstrated overall improvement. See [complete final results](model-evaluations/upload-v3/final.json).

### Experiments and selection

1. **Recent pooled training:** prepare 661,099 positive-amount 2017 transactions from fitting customers. Keep every fraud and a deterministic 10% of legitimate rows for the pilot, after building histories; give sampled legitimate rows inverse inclusion weights. Compare personal-history features, file-local merchant context, fivefold fraud weighting, and deeper CatBoost trees, with global and channel thresholds. The 66,403-row pilot contained only 110 frauds, all chip transactions. The weighted-context candidate reached 74.68% precision and recall on the 2018Q1 selection population. That population had no online fraud, so it could not establish an all-channel winner. [Pilot results](model-evaluations/upload-v1/pilot.json).
2. **Broader pooled training:** expand the fitting source to 2015–2017: 1,966,545 transactions and 2,774 frauds from 378 customers. Repeat the four candidates on a 199,724-row pilot. Earlier frauds were mostly online, and pooled training regressed sharply on the later chip-heavy selection population. More data was not sufficient. The source-to-feature replay checks passed. [Pilot results](model-evaluations/upload-v2/pilot.json), [raw parity](model-evaluations/upload-v2/raw-parity.json).
3. **Channel specialists:** fit chip candidates on 2017 chip transactions and online/swipe candidates on their 2015 through June 2016 transactions. Select chip configuration on 2018Q1; select online/swipe configurations using 2016Q3 plus 2018Q1. Every selection period is later than its expert's training. Use separate customer groups for fitting, selection and calibration. The selected chip model uses upload context; online and swipe use weighted upload context. Full training uses 500 trees per expert on all 759,090 eligible fitting transactions, containing 2,003 frauds. No merchant-fraud feedback, account IDs or merchant IDs enter predictors. [Selection](model-evaluations/upload-v3/selected.json), [frozen models](model-evaluations/upload-v3/frozen.json).

Chip calibration uses 2018Q2; online/swipe calibration combines 2016Q4 and 2018Q2 from calibration-only customers. A documented amendment jointly chooses the three thresholds to maximize pooled minimum precision/recall, then F1, then precision. It searches whole-score-tie cutoffs on calibration data only. The original individual thresholds and stricter precision targets remain diagnostic alternatives. The model weights were not changed by this step. [Joint policy and calibration counts](model-evaluations/upload-v3/joint-policy.json), [policy amendment](model-evaluations/upload-v3/joint-policy-protocol.json).

The false-positive problem persists on later customers: 341 of the primary candidate's 364 false alerts are chip transactions. It misses all 19 final swipe frauds, whereas V13 catches 13. The final population contains **no online fraud**, so online recall is not estimable there. Swipe selection has only 15 frauds from seven customers; its calibration has 26 from five customers. These are material coverage limitations, not evidence of reliable detection. The next research priority is reducing chip false alerts and improving swipe coverage, with any subsequent changes assessed on a new reserved population. This final set must not be reused as fresh confirmation.

### Showcase results and scope

The 13 showcase users were excluded from every new fitting, selection, calibration and final population. Only after the final evaluation was complete were the six existing files scored. On the 10,000-row sample the primary candidate catches **97 of 123 frauds with six false alerts**: 94.17% precision and 78.86% recall, versus V13's 40 detections and zero false alerts. The 50-row sample improves from four to seven detections, without false alerts. [All sample diagnostics](model-evaluations/upload-v3/showcase-diagnostics.json).

These better showcase numbers do not override the failed broader evaluation. The samples are curated, overlapping and more fraud-dense; they are not a replacement test set. The IBM source itself has been used in previous research, so the customer/time reservation is new to this experiment, not proof of a previously unseen external dataset or real-world validation. No samples were relabeled or regenerated to improve results.

Research metric functions use numeric zero for undefined denominators during optimization. Treat recall as **not estimable** when there are no frauds and precision as **not estimable** when there are no alerts. A zero-calibration-alert cutoff is finite and above the calibration maximum; it does not guarantee abstention on future scores. Channel margins are not calibrated probabilities or a shared ranking.

### Artifacts and reproduction

Models and per-transaction predictions are retained under `training_data/upload-v3/`; reports and hashes are under `docs/model-evaluations/upload-v3/`. V13's installed bundle and sample catalog remain unchanged. The research adapter, threshold ties, label isolation, model routing and artifact checks pass 19 focused tests; both research modules pass strict typing and lint. Saved/reloaded model predictions agree exactly, and final confusion matrices were checked independently with scikit-learn. [Verification](model-evaluations/upload-v3/verification.json).

From the repository root, set `PYTHONPATH=backend`. The reproduction sequence uses `backend/.venv/Scripts/python.exe -m ml.upload_research` with `freeze`, `extract`, `features --split <name>` for each split, and `pilot`. For `--experiment upload-v2`, run `freeze`, `extract`, `features --split fit`, then `pilot`; unchanged development/final caches are copied from upload-v1. Then use `-m ml.upload_specialists` with `prepare`, `pilot`, `train`, `joint-policy`, `evaluate`, and `samples`, in that order. Preparation and final evaluation reject existing output directories/results; preserve this completed evidence and use an isolated research copy for reruns. No model or policy should be retuned against the recorded final outcomes.

Implementation references: [CatBoost weighting parameters](https://catboost.ai/docs/en/references/training-parameters/common) and [scikit-learn grouped and chronological validation](https://scikit-learn.org/stable/modules/cross_validation.html).

## Code organization

All maintained ML code lives in `backend/ml/`; there are no version-numbered Python packages or separate historical experiment runners.

The cleanup reduced ML source from 89 files / 9,904 lines to 24 files / 1,744 lines and removed 31 retired scripts. The [cleanup audit](maintenance/source-cleanup.json) records removed files, retained hashes and validation. That was the earlier source-cleanup checkpoint. Runtime integration additionally retired the deterministic engine and its profile evaluators. Accepted-model replay still matches 206,709 evaluation rows exactly.

| Location | Responsibility |
| --- | --- |
| `artifacts.py`, `config.py`, `data.py` | Workspace paths, accepted-model settings, checked feature caches and fitting populations |
| `features/` | Prior account history, transaction/merchant context, geography and delayed feedback |
| `estimators.py`, `models.py`, `resources.py` | Estimator construction, numerical checks, fitting/scoring and resource limits |
| `policies/` | Thresholds, causal follow-up, specialist calibration and combined/online decisions |
| `baseline.py`, `accepted.py` | Load the accepted model's component artifacts and reproduce their scores and decisions |
| `metrics.py`, `statistics.py` | Confusion counts, clustered uncertainty and selection criteria |
| `reference.py`, `verify.py` | Independent causal calculator and accepted-model regression verification |
| `backend/tests/ml/` | Feature, artifact-integrity, model and policy tests |

The policy layers have descriptive names because the accepted model combines several stages. Their stored JSON fields retain historical names to preserve artifact compatibility. `models.fit` remains available for future experiments; obsolete searches and one-off report generators were removed.

## Verification

From `backend`, using the project environment with the ML dependency group installed:

```powershell
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m mypy app ml
.venv/Scripts/python.exe -m ruff check app ml tests
.venv/Scripts/python.exe -m ml.verify
```

The last command checks the accepted registry and artifact digests, replays base and specialist model scores, reproduces calibration decisions and independent causal follow-ups, and checks metrics and uncertainty for all three pilot periods plus the full latest reference. It writes `docs/maintenance/accepted-model-verification.json`. The full reference overlaps the latest pilot period and is not a fourth independent cohort. Verification does not retrain models or rewrite historical reports.

## Data and historical evidence

`training_data/` is ignored local input and artifact storage. The earlier cleanup removed 1,462 obsolete generated files; later behavioral and IEEE experiments add their own immutable research directories. Their versioned directories identify data lineage. The application bundle lives in `backend/model_artifacts/v13/` and runs without research files. Accepted-model replay needs retained artifacts. The [V13 audit](model-evaluations/strategy-v1/ibm-audit.json) identifies historical fitting tables that were not retained; a complete raw-CSV V13 retraining pipeline is not supplied.

`docs/simulator-evaluation/` retains the accepted-model registry, completed experiment reports and aggregate evidence. Historical reports describe the code and commands present when each experiment ran. Their old runner commands and source-file manifests are historical records after this cleanup; use the current verification command above. The failed v14 implementation was removed after its results and verification were recorded.

Before another model search, inspect additional historical IBM fraud episodes and use forward-only training blocks while preserving substantial base fitting history. More complex models alone did not resolve the observed supervision gap. Independent later data is needed for a stronger generalization claim.


## Runtime architecture

`app/domain/model_inputs.py` maps an explicit source-field allowlist into the same account-history, merchant-context and geography feature functions used in research. It never maps broad merchant categories to invented MCCs or reads ground-truth labels as predictors. Same-time events are evaluated together before updating state. Account state is scoped; merchant context spans submitted accounts. Completion status affects future history only.

`ml/runtime.py` loads the ten checked model files once, scores each seed pair, and averages within each model family. It applies the original recent-model, corroborated history and historical-online policies, then adds depth6 online alerts. Thresholds stay frozen. A process lock bounds concurrent model calls and numerical libraries use two threads. `ml/package.py` reproducibly exports the package from the accepted artifact lineage. Its manifest digest is pinned in runtime source; API/CSV inputs cannot choose pickle paths.

`app/domain/engine.py` produces learned event results and metrics. `app/domain/assessment.py` preserves lifecycle accounting and immutable dataset results, records unsupported rows separately and omits legacy profiles from new runs. Historical schemas and frontend readers remain for saved results. The UI shows model margins and detection paths; rule-point fields remain null for learned results.

Uploaded records have no confirmed delayed fraud-feedback source. The three merchant-feedback features therefore use the original zero-support representation and the result explicitly reports partial context. There is no implicit join to research labels or other datasets. This is the same trained estimator and policy, but potentially different available evidence; the benchmark metrics must not be attributed to arbitrary uploads.

Run `python -m ml.verify_runtime` from `backend` to check exact package predictions against the 51,889-row latest frozen benchmark. See [runtime parity](maintenance/runtime-model-verification.json), [data cleanup](maintenance/data-cleanup.json), and [rule retirement](maintenance/rule-engine-retirement.json). The four historical reference runs contain 206,709 rows in total, including an overlapping latest pilot/full cohort.

## Generated 2,400-row experiment

The user-supplied `riskflow_simulator_realistic_2400.csv`, guide and reference profiles exactly match the preserved copies under `fixtures/evaluations/simulator-v2/`. They contain 2,400 rows across 70 accounts, with 1,642 purchases. The original has no exact MCCs, merchant identifiers or fraud labels. Its `pos` channel does not distinguish chip from swipe. Datasets import retains all 2,400 rows; none can be scored by V13 without additional inputs. Retained preview, ledger and assessment report that consistently. Temporary CSV import now rejects the original at preview: all 1,953 payment/bill-payment rows lack compatible model inputs, so Build graph is not offered and the existing workspace stays intact. The guide is contextual test documentation, not an instruction to reinstate its retired rule-point expectations.

`scripts/evaluate_generated_2400.py` runs a separate sensitivity experiment on 1,615 completed/declined purchases. It excludes 27 pending purchases and 758 non-purchase records. It assigns category-level MCCs, treats ecommerce/mobile-app purchases as online, and tests chip versus swipe for POS. Merchant grouping is tested by name/country and by name/country/city/state. These are authored assumptions, not recovered facts. The original files, model weights and thresholds are unchanged. August-only reference profiles are not used as V13 predictors; no future baseline or guide case label is injected.

| Assumed POS channel | Assumed merchant grouping | Scored | Alerts | Alert rate |
| --- | --- | ---: | ---: | ---: |
| Chip | Brand and country | 1,615 | 20 | 1.24% |
| Swipe | Brand and country | 1,615 | 20 | 1.24% |
| Chip | Branch and country | 1,615 | 28 | 1.73% |
| Swipe | Branch and country | 1,615 | 28 | 1.73% |

Eighteen transactions alert under all four variants, 30 under at least one, and 12 decisions change with the merchant-grouping assumption. Changing POS technology does not change final decisions in these runs. All alerts originate from the historical online model paths. None of the 46 scored transactions named in the guide's 11 cases alerts; the additional named refund is not scored. That includes the described rapid online attempts and device-sharing cases. V13 does not use device familiarity/sharing, so these examples expose a mismatch between the scenarios the guide emphasizes and the model's available evidence. Lack of an alert here is not measurable missed fraud: the guide explicitly supplies no fraud ground truth.

Accuracy, precision, recall and F1 are **undefined for this dataset**. An alert rate is not a false-positive rate. These results neither confirm nor refute the IBM confusion matrix; they show that its performance cannot be assumed on another generator, incomplete history and authored categorical inputs. Use separately labeled, source-native inputs before making a generalization claim. Do not tune thresholds against these illustrative cases and call the result validation.

Reproduce from the root with `backend/.venv/Scripts/python.exe scripts/evaluate_generated_2400.py`. The script exercises import, assessment and immutable saved-result reopening in temporary databases; it does not modify personal datasets. [Full report](model-evaluations/generated-2400/report.json), [per-transaction margins and decisions](model-evaluations/generated-2400/predictions.csv), and [input assumptions](../fixtures/evaluations/generated-2400/assumptions.json) record the evidence. The four `assumed-*.csv` files in that fixture directory are importable demonstrations.

## Supplied 10,000-row card-format test

The three user-supplied `riskflow_ibm_card_test_10000_*` files are preserved byte-for-byte as `unlabeled.csv`, `labeled.csv` and `ground-truth.csv` in `fixtures/evaluations/card-format-10000/`. The test has 10,000 rows, 100 users, 136 User+Card instruments, 180 labeled frauds and 9,820 labeled legitimate transactions. All feature columns agree between the labeled and unlabeled files. Ground-truth row numbers, account/card identities, minute timestamps and labels were checked before joining outcomes. The ground-truth file has additional seconds and scenario descriptions; none are used for inference.

| Metric | Frozen V13 result |
| --- | ---: |
| Accuracy | 96.32% |
| Precision | 15.69% |
| Recall | 23.89% |
| F1 | 18.94% |
| True positives | 43 |
| False positives | 231 |
| False negatives | 137 |
| True negatives | 9,589 |

All 274 alerts are online transactions. The model detects 19/42 account-takeover cases, 22/51 international-online cases and 2/26 card-testing cases; it detects none of the 35 electronics-cashout or 26 counterfeit-swipe frauds. All false alerts occur in rows labeled ordinary or ordinary/genuine-travel. An always-no-alert baseline has 98.20% accuracy and zero recall, illustrating why accuracy alone is misleading here.

These results show poor transfer to this supplied scenario-labeled test. They do not reproduce the original IBM benchmark. The files use IBM-style columns, but column compatibility does not establish the same generating process or verified real-bank outcomes. History starts with the supplied January-June 2018 rows, confirmed merchant-fraud feedback is absent, and the precision-focused thresholds remain those selected in prior research. The measured weakness is retained as evidence; no weights, thresholds or source labels were changed to improve this result.

Native card import combines Year/Month/Day/Time, groups history by User+Card, and uses the signed Merchant Name value as a merchant identifier. Blank Errors? is interpreted as completed and other values as failed attempts. USD and a UTC clock are disclosed assumptions; a selected source UTC offset overrides the latter. Transactions retain minute precision, with absent seconds set to zero and equal-time history handled causally. Optional labels affect sandbox truth metrics only. Retained imports generate content-based event identities excluding labels, plus occurrence counts for exact duplicates; they do not claim authoritative source transaction IDs. Older pending import previews must be regenerated under normalizer version 4; saved events and assessments remain readable.

Run `backend/.venv/Scripts/python.exe scripts/evaluate_card_format_10000.py` from the project root to reproduce the evaluation using only the unlabeled input. [Report with channel/month/scenario breakdowns](model-evaluations/card-format-10000/report.json) and [transaction predictions](model-evaluations/card-format-10000/predictions.csv) preserve input hashes, model digest, raw margins, labels and decisions. The browser imports both full transaction files and reproduces the same alert IDs; retained import, assessment and reopening are also tested.
