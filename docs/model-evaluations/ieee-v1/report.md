# IEEE-CIS chronological benchmark

This is RiskFlow's first separate IEEE-CIS benchmark. It evaluates source-specific supervised learning without pooling unrelated synthetic labels or promoting a model for arbitrary uploads. See the [strategy revision](../strategy-v1/report.md) for product changes and the V13 audit.

## Data and evaluation contract

The existing user-provided files are preserved under `training_data/ml-general/data/`. `train_transaction.csv` contains 590,540 unique transaction keys; `train_identity.csv` contains 144,233 unique keys. A validated left join preserves transactions without identity records and adds an explicit availability indicator. There are no orphan identity keys. Competition test files and sample submission are unused.

The source hashes match the earlier workspace structural audit:

- Transactions: `3a5c83ab6b3cc13dcabe5ffa9f522307fd5f7f7b6e6f6a60c32284ca6283d642`.
- Identity: `b63c725d8377be90a995268d97f347c17d456b95db45807adcf9f59cd603c37c`.

Official release byte-equivalence and acquisition terms were not independently verified. No download, competition submission, rule acceptance or redistribution occurred. The [competition page](https://www.kaggle.com/competitions/ieee-fraud-detection/data) identifies the intended source; measured results here apply to the provided, hashed files.

`TransactionDT` supplies relative seconds. Day boundaries below are half-open intervals after dividing by 86,400; no absolute dates or timezones are invented. All equal-time records stay in the same period. Seven-day gaps are an explicit availability assumption, not verified adjudication delays. This follows the principle of forward validation described in the [Fraud Detection Handbook](https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_5_ModelValidationAndSelection/ValidationStrategies.html).

| Period | Relative days | Transactions | Fraud | Identity coverage |
| --- | --- | ---: | ---: | ---: |
| Fitting | [1, 112) | 386,298 | 13,211 | 26.77% |
| Model and threshold selection | [119, 140) | 62,076 | 2,213 | 18.29% |
| Probability calibration | [147, 161) | 41,118 | 1,236 | 17.47% |
| Final evaluation | [168, 183) | 40,641 | 1,596 | 21.04% |

The [protocol](protocol.json) was frozen before fitting. All permitted transactions are included without negative downsampling or class reweighting. Minimum positive support was declared in advance. Feature preparation excludes `isFraud`; development labels are extracted only for permitted periods. All six sets of final predictions are hashed before final labels are extracted. Raw text for final rows exists in the same source CSV, so this is a procedural holdout rather than an externally sealed competition evaluation.

## Models and selection

The basic feature set contains 14 supplied amount, product, card, address, email-domain and device attributes. The full set adds the remaining provided transaction/identity fields and identity availability. Transaction keys, relative timestamps, target and bookkeeping fields are excluded from both feature sets. Card combinations are not treated as authoritative customer IDs. No merchant graph, confirmed account history or synthetic device intelligence is invented.

Logistic regression uses fitting-only median imputation, scaling and bounded one-hot encoding with unseen-category handling. CatBoost uses native categorical handling, ordered input (`has_time=True`), learning rate 0.06, L2 10 and maximum categorical-combination complexity one. Exact configurations and feature lists are in the model receipts. The four base-seed candidates are:

| Candidate | Features | Trees / depth | Selection AP | Fraud captured at daily 1% |
| --- | --- | --- | ---: | ---: |
| Logistic | Basic | Not applicable | 0.1817 | 228 / 2,213 (10.30%) |
| CatBoost | Basic | 300 / 6 | 0.2329 | 269 / 2,213 (12.16%) |
| CatBoost | Full | 300 / 4 | 0.5014 | 506 / 2,213 (22.86%) |
| CatBoost, selected | Full | 500 / 6 | 0.5238 | 506 / 2,213 (22.86%) |

Each selection queue has 633 reviews: the ceiling of 1% is applied separately each day. The deeper full-feature model wins the prespecified AP tie-break. The [nomination](nomination.json) precedes final target access. Seeds 20261025 and 20261026 repeat that configuration on the identical fitting population; the base seed is 20261024. No fitting-plus-selection refit occurs. Each model's raw-score F1 threshold comes only from selection; each sigmoid calibrator uses only the separate calibration period.

## Final results

The final period has 40,641 transactions, 1,596 frauds and 3.927% prevalence. Each daily 1% queue produces 413 total reviews; each daily 5% queue produces 2,038. Daily ceilings explain why these totals are slightly above exactly 1% and 5% of the aggregate population. All candidates use the same transactions and capacities. Predictions were [frozen](prediction-freeze.json) before outcome extraction; [complete results](results.json) preserve every candidate and seed.

| Model / seed | AP | Trapezoidal PR-AUC | Fraud at 1% | Precision at 1% | Recall at 1% | Fraud at 5% | Recall at 5% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Logistic basic / 20261024 | 0.1522 | 0.1516 | 131 | 31.72% | 8.21% | 459 | 28.76% |
| CatBoost basic / 20261024 | 0.2262 | 0.2256 | 189 | 45.76% | 11.84% | 518 | 32.46% |
| CatBoost full depth 4 / 20261024 | 0.4778 | 0.4777 | 343 | 83.05% | 21.49% | 825 | 51.69% |
| **Selected full depth 6 / 20261024** | **0.5061** | **0.5060** | **347** | **84.02%** | **21.74%** | **839** | **52.57%** |
| Full depth 6 / 20261025 | 0.5084 | 0.5083 | 350 | 84.75% | 21.93% | 850 | 53.26% |
| Full depth 6 / 20261026 | 0.4882 | 0.4881 | 340 | 82.32% | 21.30% | 840 | 52.63% |

The primary selected model finds **216 additional frauds** over logistic regression at the same 413-review budget, improving recall by 13.53 percentage points. It finds 158 more than basic CatBoost. At 5%, its precision is 41.17%: 839 true detections and 1,199 false alerts among 2,038 reviews.

At the 1% budget there are 347 true detections and 66 false alerts, with 1,249 frauds outside the queue. Even a perfect ranking cannot capture more than 413 of 1,596 frauds (25.88%) with that capacity. High queue precision therefore coexists with low overall recall. These are daily retrospective investigation queues, not an online authorization policy with knowledge of future daily volume.

The prespecified 500 paired circular seven-day block draws give these 95% sensitivity intervals for the selected model's **1% recall difference**:

| Reference | Observed difference | Time-block interval |
| --- | ---: | ---: |
| Logistic basic | +13.53 percentage points | +11.51 to +15.42 |
| CatBoost basic | +9.90 percentage points | +8.94 to +10.85 |
| CatBoost full depth 4 | +0.25 percentage points | -0.32 to +0.77 |

Across the three selected-configuration seeds, AP ranges from 0.4882 to 0.5084 and 1% recall from 21.30% to 21.93%. The original seed remains the primary result; the best final seed is not substituted. The deeper model adds only four detections over full depth 4, and its interval includes no gain. The larger improvement comes from the supplied information, not simply additional model complexity.

### Fixed selection thresholds

These are the thresholds selected by F1 on the selection period, not thresholds tuned on the final labels or constrained to a fixed daily review count.

| Model / seed | TP | FP | FN | TN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Logistic basic / 20261024 | 313 | 1,683 | 1,283 | 37,362 | 15.68% | 19.61% | 0.1743 |
| CatBoost basic / 20261024 | 390 | 728 | 1,206 | 38,317 | 34.88% | 24.44% | 0.2874 |
| CatBoost full depth 4 / 20261024 | 762 | 1,061 | 834 | 37,984 | 41.80% | 47.74% | 0.4457 |
| Selected full depth 6 / 20261024 | 748 | 572 | 848 | 38,473 | 56.67% | 46.87% | 0.5130 |
| Full depth 6 / 20261025 | 768 | 638 | 828 | 38,407 | 54.62% | 48.12% | 0.5117 |
| Full depth 6 / 20261026 | 709 | 564 | 887 | 38,481 | 55.70% | 44.42% | 0.4942 |

### Calibration

Sigmoid calibration uses the separate 41,118-row period with 1,236 frauds (3.006% prevalence), without refitting the predictors. Final prevalence rises to 3.927%. A constant probability equal to calibration prevalence has final Brier loss 0.037813 and log loss 0.166949.

| Model / seed | Brier loss | Log loss |
| --- | ---: | ---: |
| Logistic basic / 20261024 | 0.035674 | 0.148875 |
| CatBoost basic / 20261024 | 0.033987 | 0.141004 |
| CatBoost full depth 4 / 20261024 | 0.026602 | 0.111305 |
| Selected full depth 6 / 20261024 | 0.025693 | 0.106759 |
| Full depth 6 / 20261025 | 0.025516 | 0.106551 |
| Full depth 6 / 20261026 | 0.026096 | 0.109030 |

Lower aggregate loss than the prior does not establish perfect calibration. For the primary model, the 0.2-0.3 bin averages 24.43% predicted versus 30.87% observed fraud among 311 records. The 0.9-1.0 bin averages 95.70% predicted versus 91.03% observed among 223 records. All bins are preserved in the results; no final-period recalibration is performed.

### What would improve this further

The evidence favors auditing and improving usable information before adding more model depth. A follow-up should examine which provider-feature groups contribute gains, check their observation-time semantics, and use rolling development windows to measure drift and calibration stability. Such comparisons belong in development periods; this final period is now consumed. More temporal or source coverage would be needed for another independent confirmation.

Ordinary-upload improvements need an explicit information contract: reliable transaction time, stable supplied identities, sufficient history and clearly observed outcomes for evaluation. Descriptive amount/activity comparisons and graph evidence remain useful when those conditions do not support supervised predictions. This experiment does not justify pooling unrelated datasets or labeling anonymous feature similarity as a validated domain match.

## Interpretation boundaries

Comparing basic CatBoost with basic logistic regression isolates model family on matched inputs. Comparing full CatBoost with either basic model also changes available information. Opaque provider fields have unknown construction and observation-time semantics; their predictive value does not prove that RiskFlow could compute them during a payment authorization.

There are only fifteen final days. Circular seven-day paired block resampling is limited temporal sensitivity analysis, not an account-cluster or cross-institution guarantee. The dataset does not provide an authoritative stable account identity for a customer-disjoint evaluation. Seed variation tests fitting randomness on the same outcomes, not independent test sets. This final period becomes consumed evidence after publication and must not be retuned into a fresh holdout.

Probability calibration is assessed only within these IEEE periods. No probability or classifier is exposed for ordinary CSV uploads. V13 uses different inputs, populations and alert paths, so its synthetic IBM headline is not a directly comparable competitor on this table. The retired point-rule engine is not recreated as an unsupported IEEE baseline.

## Resources and reproduction

The declared resource budget is two numerical threads and 2.5 GiB per process. Initial whole-table preparation exceeded that limit; preparation was changed to 25,000-row chunks, retaining label-free aborted files and the same source population and splits. Successful preparation peaked at 0.546 GiB. See [preparation correction](preparation-correction.json).

A first attempt to train the deepest candidate after another model in one process exceeded the cap and was stopped before saving that model. The identical candidate was restarted in a fresh process. Its recorded peak was 2.477 GiB. The initial shell reported a nonzero exit despite the completed receipt and output; [fresh-process replay](retry-verification.json) verifies the saved artifact and every selection score. CatBoost emitted soft RAM-budget warnings. See [retry record](resource-retry.json); failed attempts are not concealed as compliant runs.

All six completed fits were within the 2.5 GiB cap, with recorded peaks from 1.856 to 2.477 GiB. Logistic fitting/scoring took 8.5 seconds, basic CatBoost 123.8 seconds, full depth 4 214.8 seconds and the three depth-6 runs 397.4-450.5 seconds. Timings include loading and selection scoring; concurrent seed fits and machine load limit speed comparisons. Preparation and failed attempts are additional work.

The implementation is `backend/ml/ieee/`. From the repository root with `PYTHONPATH=backend`, the CLI actions are `freeze`, `prepare`, `labels`, `train NAME [SEED]`, `nominate`, `predict`, `evaluate` and `audit`. Each training command must run in a separate process. Frozen outputs reject overwriting: these commands document the completed sequence, not instructions to replace this published run. A new experiment needs a new version and untouched evaluation period.

The original V13 bundle, source CSVs, personal planning files and historical reports are preserved. The [strategy validation record](../strategy-v1/validation.json) contains 258 backend tests, 210 frontend unit tests, 15 targeted browser tests, strict typing, lint and production-build checks. Browser assertions passed; stalled dedicated test servers required verified cleanup before the runner exited zero. The existing bundle-size advisory remains.

The [numerical audit](numerical-audit.json) verifies all six frozen prediction files and independently reconstructs both review queues and confusion counts. Additional [validation](validation.json) independently recomputes AP, trapezoidal PR-AUC, Brier loss and log loss, verifies finite bounded probabilities, checks each completed fit's memory receipt, rechecks source hashes and confirms the protected plans and V13 package are unchanged. The minor historical-assessment wording fix was followed by fresh formatting, typecheck, lint and production-build checks.
