# V3: three small experiments and separate confirmation

**Decision: retain the v2 EBM as the research incumbent.** The best pilot method, an equal EBM–CatBoost blend, improved confirmation recall from 42.59% to 44.07%, but the gain was not statistically significant. It failed the predeclared replacement gate. The blend did pass the separate comparison against standard CatBoost, whose recall was 36.67%; beating that baseline alone was insufficient to replace the incumbent.

This is a completed negative upgrade experiment. The implementation, fitted packages and evaluation are preserved; no new model was activated in the application, no confirmation-dependent candidate was substituted, and no thresholds were relaxed.

![Pilot and confirmation results](comparison.svg)

## Methods and small experiments

Three fixed alternatives were implemented:

1. **Fraud-weighted EBM:** retain the v2 features and estimator configuration, but give each fraud-labelled training purchase 20 times the weight of a legitimate purchase.
2. **Longer EBM:** retain the features, increase training from 256 to 1,024 rounds and interactions from five to ten.
3. **Equal blend:** average the raw scores from the incumbent EBM and standard CatBoost. The 50/50 weight is fixed, not fitted against screening or confirmation labels. Scores remain rankings, not calibrated probabilities.

The pilot fits 143,204 July–December 2018 purchases with 190 frauds across 23 users. Screening uses 147,540 January–June 2019 purchases with 217 frauds across 25 different users. A fixed user hash selects disjoint quarters of the existing fit-role population. Complete histories are preserved; legitimate examples are not undersampled. All methods see identical rows, with two fixed seeds. Across eight individual fits, recorded model-fitting time totals 101 seconds and process peak memory is 1.46 GiB.

| Method | Mean recall at 1% | Mean average precision | Screening outcome |
| --- | ---: | ---: | --- |
| Refit v2 EBM | 32.72% | 0.04408 | Incumbent reference |
| Standard CatBoost | 28.34% | 0.04652 | Strong-ML reference |
| Fraud-weighted EBM | 26.73% | 0.03206 | Rejected |
| Longer EBM | 19.82% | 0.02457 | Rejected |
| Equal blend | **35.94%** | **0.06776** | Sole nominee |

The blend found seven additional frauds under each seed: 77 versus 70 and 79 versus 72, using the same 1,476-review budget. It gained 3.23 percentage points of recall for both seeds, without AP regression. Only it passed the screening conditions. Weighting rare examples and increasing model capacity both underperformed; this experiment does not establish why, and their parameters were not tuned further after observing the losses.

Screening nominated a method; it did not establish significance. Full search results, quarterly metrics, seeds and timings are in [screening.json](screening.json). The [design](design.md) and [protocol](protocol.json) were saved before these experiments.

## Separate confirmation and fair comparisons

The consumed v2 reserved-user 2019 benchmark was not reused. Confirmation uses 206,730 eligible 2019 purchases from the **validation-role** cohort, with 270 frauds across 28 users. V2 had audited this cohort's aggregate label support, and its earlier observations had participated in previous development. Its 2019 candidate performance had not been evaluated. It is a fresh transaction-performance confirmation within an already studied synthetic source, not a claim about entirely never-seen people or a new dataset.

All v3 fitting and screening exclude these confirmation users. Before confirmation, the selected blend and both components were refitted using the same 576,698 July–December 2018 fit-role purchases, containing 882 frauds across 103 users. The incumbent comparator uses the v2 recipe refitted on those identical rows. It is not the old v2 package trained on a larger cohort. This prevents training-set differences from masquerading as algorithm improvement.

Candidate identity froze after screening. Models, source hashes and all 206,730 predictions froze before the confirmation label join. No losing pilot method was scored on confirmation. See the [final model manifest](final-models.json), [prediction freeze](predictions.json) and [label-access ledger](label-access.jsonl).

| Method | Fraud found / 270 | Recall at 1% | Precision at 1% | Average precision | Recall at 2% | Recall at 5% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Refit v2 EBM | 115 | 42.59% | 5.56% | 0.10820 | 57.04% | 80.37% |
| Standard CatBoost | 99 | 36.67% | 4.79% | 0.10459 | 48.15% | 64.07% |
| Equal blend | 119 | 44.07% | 5.75% | 0.13042 | 62.22% | 81.85% |

Each method scores every eligible purchase and receives the same 2,068-review primary budget. The blend's queue contains 1,949 false reviews and misses 151 eligible frauds. Higher 2%/5% recall is sensitivity information; those budgets were not substituted for the failed primary endpoint.

## Statistical decision

The prespecified gate required at least two percentage points higher recall, a strictly positive paired lower confidence bound, no average-precision point regression and no coverage regression against **both** comparators. Support requirements were 100 frauds across 20 users. The paired bootstrap keeps a user's transactions together and recomputes top-K for each of 2,000 sampled populations. Two 97.5% intervals allocate a family-wise 5% error budget across the two planned comparisons.

| Blend minus comparator | Recall gain | Paired user 97.5% interval | Decision |
| --- | ---: | ---: | --- |
| Refit v2 EBM | +1.48 pp | **−3.79 to +6.99 pp** | Fails significance and minimum-gain requirements |
| Standard CatBoost | +7.41 pp | **+0.31 to +14.43 pp** | Passes this comparison |

The confidence interval against the incumbent permits both harm and improvement; it is not evidence of equivalence. The CatBoost lower bound is positive but narrow. Month-block sensitivity agrees with the two decisions: −3.54 to +5.31 points versus the incumbent, and +0.81 to +16.67 versus CatBoost. These are separate sensitivity analyses, not a combined two-way dependence model.

The new 44.07% result must not be compared directly with v2's earlier 49.55%: the evaluation populations and allowed fitting cohorts differ. The same-population comparisons above are the controlled evidence. The experiment does not establish a novel algorithm or improved real-bank effectiveness.

## Coverage and remaining gaps

Chip transactions supply 248 frauds across 27 users. Swipe contributes only 22 frauds across two users; online has 28,755 purchases and no labelled fraud. Broad swipe and online effectiveness remain unvalidated. Channel metrics in [results.json](results.json) rerank within each channel and must not be added together as if they shared the global queue.

The source cohort contains 215,694 rows and 275 fraud labels. Positive-purchase eligibility excludes 8,964 zero/negative-amount rows, including five fraud labels. Performance applies to the eligible synthetic purchase task. Investigative time, calibration, live decision quality and external-source transfer were not measured.

## Implementation validation

The code lives in `backend/ml_v3/`, reusing frozen historical features. The two retained component packages total 1,095,477 bytes. Final fitting took 13.76 seconds for EBM and 79.54 seconds for CatBoost; the recorded process peak was 1.59 GiB. No GPU, additional data or new dependency was needed.

Both models survived serialization with exactly unchanged checked scores. On 64 development purchases, native component contributions and the algebraically weighted blend contributions reconstruct raw scores within 1.96e-14. The blend explanation is half of each component's contributions and half of each intercept; it is not a causal explanation or a fraud probability. Existing historical-evidence semantics are unchanged.

All **230 backend tests pass**, including five new v3 tests for seed-stable selection, failed significance gates, frozen-label access, score/contribution arithmetic and population-limited label reads. The label-isolation test deliberately makes an excluded outcome raise an error; a broad label query fails while the selected-population query succeeds. Strict typing passes for 69 source files; backend and helper lint/format checks pass. Frozen v2 source/input/model/prediction hashes remain valid. See [verification.json](verification.json).

The verifier reloads both final packages, reproduces every confirmation score exactly and recomputes the same numerical report. This replay is not a new statistical experiment. A second complete pilot-and-final training rebuild was not performed. Reproduction commands are in [reproduction.md](reproduction.md).

The blend remains an evaluated research alternative. V2 remains the incumbent, and the application's existing rules remain active pending the separate learned-model integration milestones. Future improvement work needs a newly declared confirmation population; this cohort is now consumed and must not become a repeatedly reused significance target.
