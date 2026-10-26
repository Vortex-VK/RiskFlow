# RiskFlow ML v2: measured improvement and remaining limits

The development-selected explainable boosting model with gradual, recency-weighted history (`ebm_soft`) found **219 of 442 frauds (49.55%)**, versus **31 (7.01%) for existing rules**, when reviewing the same 2,889 transactions. The reserved population contains 288,883 eligible synthetic purchases from 2019, with fraud across 48 users. This passes the predeclared statistical upgrade gate over rules.

It does **not** establish superiority over a serious ML baseline. Tuned standard CatBoost found 204 frauds (46.15%); the selected model's 3.39 percentage-point advantage is below the five-point requirement, its paired interval crosses zero, and its average precision is slightly lower. The gradual-history feature hypothesis also remains inconclusive. These are separate findings, not a claim that every part of v2 improved detection.

The application still runs its existing rule engine. V2 delivers the offline pipeline, frozen models, reproducible evaluation and a standalone explanation viewer. Statistical eligibility over rules does not establish completed API/UI integration or production effectiveness.

![Reserved comparison at equal review capacity](comparison.svg)

## What changed

V2 uses the existing IBM CSV, without additional external data. Extraction includes October 2017 through December 2019: 3,879,502 source rows, of which 3,690,072 are eligible positive purchase attempts. Two chronological development folds compare seven retained candidates, with two configurations per nonlinear model family. Each family uses its selected standard-feature configuration unchanged for its feature ablations. All final learned models fit the same 680,574 July–December 2018 purchases, including 1,056 frauds across 124 development users.

The new history measurements discount older completed spending with a 30-day half-life inside a 90-day window. Category estimates gradually blend toward account history when category evidence is sparse, replacing the hard ten-observation switch. Explicit evidence strength, amount deviation and recent change measurements accompany the estimates. Strictly preceding, available observations determine features; labels and current transaction status are excluded. See the [feature dictionary](feature-dictionary.md).

The selected model is a small EBM: 256 boosting rounds, up to five interactions and 30 input measurements. Native additive contributions reconstruct its raw score. Explanations show recorded measurements and preceding source records; they describe learned associations, not causal reasons or calibrated fraud probabilities.

## Frozen evaluation

Reserved-user membership is unchanged from v1. Their previously inspected June 2018 outcomes were not reused for v2 selection or evaluation. V2 froze full-year 2019 as its test before reading those outcomes. Candidate selection, parameters, feature definitions, support thresholds and claims froze before scoring; all final predictions were saved before the label join. No candidate was replaced after observing results. The [design](design.md), [selection record](selection.json), [prediction manifest](predictions.json) and [label-access ledger](label-access.jsonl) provide provenance.

All methods score the same eligible population with 100% coverage. Ranking the highest-scored 1% of a completed period is an offline workload comparison, not a live payment policy. Here that budget is 2,889 reviews; 2% and 5% sensitivity budgets are 5,778 and 14,445.

| Method | Fraud found at 1% | Recall at 1% | Average precision | Recall at 2% | Recall at 5% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Existing rules | 31/442 | 7.01% | 0.00381 | 9.95% | 17.65% |
| Refit logistic | 186/442 | 42.08% | 0.07479 | 55.20% | 74.21% |
| Standard CatBoost | 204/442 | 46.15% | 0.17375 | 54.30% | 73.98% |
| Hard-history CatBoost | 198/442 | 44.80% | 0.17017 | 57.24% | 73.53% |
| Soft-history CatBoost | 200/442 | 45.25% | 0.19386 | 57.24% | 72.85% |
| Standard EBM | 211/442 | 47.74% | 0.16664 | 60.63% | 78.96% |
| Hard-history EBM | 209/442 | 47.29% | 0.14819 | 57.47% | 77.60% |
| **Selected soft-history EBM** | **219/442** | **49.55%** | **0.16989** | **61.09%** | **79.41%** |

Average precision summarizes the ranking across thresholds; it is not precision at the 1% review budget. The selected queue's precision is **7.58%**: 219 frauds and 2,670 false reviews, with 223 eligible frauds missed. It includes 612 accounts across 261 users, so 2,277 reviews revisit an account already represented in the queue. No investigator-time saving was measured.

## Uncertainty and failed hypotheses

The paired bootstrap resamples users, keeping their cards together, and recomputes each top-1% queue for 1,000 replicates. The following intervals express absolute recall differences in percentage points.

| Comparison | Point difference | Paired interval | Conclusion |
| --- | ---: | ---: | --- |
| Selected EBM minus rules | +42.53 pp | 95%: +36.97 to +48.20 | Passes all upgrade criteria |
| Selected EBM minus standard CatBoost | +3.39 pp | 95%: −1.43 to +7.99 | Fails contribution gate |
| Selected EBM minus refit logistic | +7.47 pp | 95%: −0.006 to +14.78 | Descriptive; user-level interval includes zero |
| Soft minus hard EBM | +2.26 pp | 97.5%: −0.86 to +5.62 | Incremental feature gain unproven |
| Soft minus hard CatBoost | +0.45 pp | 97.5%: −4.06 to +4.45 | Incremental feature gain unproven |

The two soft-minus-hard intervals use the predeclared Bonferroni allocation. Soft EBM versus standard EBM is also inconclusive: +1.81 pp, descriptive 95% interval −2.62 to +7.13. This experiment cannot attribute the overall improvement over rules specifically to the new personalization features.

Month-block sensitivity agrees on the main conclusions: selected-minus-rules +37.50 to +48.88 pp; selected-minus-standard-CatBoost −1.63 to +8.01 pp. These are separate sensitivity analyses, not a combined two-way confidence interval. Ten alternate rule tie-break orders give 4.98–7.47% recall, leaving the large gain over rules intact.

V1's 8/19 logistic result and v2's 219/442 result use different periods and populations and are not a controlled before/after comparison. The refit logistic row above is the fair same-population reference.

## Where it still underperforms

- **Chip transactions dominate the evidence.** They account for 396 frauds across 44 users. The global queue finds 191 and misses 205. Swipe has 46 frauds across only four users, below the channel-specific support threshold; its 28 detections cannot support a broad channel claim.
- **Online detection is unvalidated.** The reserved population has 33,921 online purchases but no labelled fraud; recall is undefined. It still contributes 193 false reviews to the global queue. In development Q4, the selected EBM missed all 33 online frauds at the global 1% budget. The corresponding earlier fit had no online positives. Final fitting includes later online positives, but this reserved test cannot demonstrate that they solved the problem.
- **Sparse history remains difficult.** Of 394 frauds with fewer than ten preceding category purchases, the global queue finds 204 and misses 190. With supported categories, it finds 15 of 48. These counts use the global budget; independently reranked segment metrics in `results.json` answer a different question.
- **Temporal and source gaps remain.** November and December contain no labelled eligible fraud, so their recall is undefined. Among months with fraud, separately reranked monthly recall ranges from 38.46% to 68.89%. No-history rows also have no positives. Empty positive groups do not establish robustness.
- **Eligibility is limited.** The full reserved source contains 303,854 rows and 457 fraud labels. Positive-purchase eligibility excludes 14,971 zero/negative-amount rows, including 15 fraud-labelled rows. The 49.55% headline applies to eligible purchases, not every source transaction. Fraud spans 279 account-day proxies; these are not verified independent incidents.

All evidence comes from synthetic IBM data. No real-bank accuracy, cross-source generalization, calibration, autonomous authorization or production scale is established.

## Engineering evaluation and inspection

The bounded development demo imports 2,675 source rows and scores 2,591 eligible purchases with complete available context. Import, current rules, feature generation, inference, explanations and persistence take **5.96 seconds** in the measured local run. Cached/imported feature and rule results match; model score difference is exactly zero. Contribution reconstruction error is at most 2.14e-14. Fresh storage reopening preserves the saved outputs. This is an isolated feasibility measurement, not a released application endpoint benchmark.

The selected serialized model is 333,862 bytes. The training process recorded a 1.92 GiB peak working set, below its 2.5 GiB process budget. Extraction took 373 seconds; feature generation took 389 seconds. A Windows EBM worker-cleanup issue was repaired by using threads; a complete same-seed candidate refit reproduced all term tables and all 51,889 checked development scores exactly. The original model artifacts remain unchanged. See [execution parity](execution-parity.json) and [feasibility](feasibility.json).

All **225 backend tests** pass, including ten v2 cases covering chronology, availability, sparse history, label-access restrictions, corrupted-cache rejection, paired intervals and native explanations. Strict typing, lint and formatting pass. The standalone viewer passes browser checks for ten examples, displayed scores, term/evidence counts and mobile width. The frozen numerical report was independently rerun from the saved predictions and matched exactly; this replay is not a second independent evaluation. A second complete extraction-and-all-model rebuild was not performed for v2. See [verification](verification.json).

Follow the [reproduction instructions](reproduction.md) to verify or rebuild the experiment and render `training_data/ml-v2/demo-inspector.html`. The viewer shows saved development examples, model contributions and the historical records behind their measurements. It runs locally and does not contact a service or imply the examples are fraud.

## Portfolio statement and remaining work

A defensible portfolio statement is: **“Built a reproducible, explainable fraud-ranking pipeline with strict historical features and frozen evaluation; detected 49.5% of labelled fraud while reviewing 1% of eligible purchases on a reserved synthetic benchmark, versus 7.0% for rules.”** Include the serious CatBoost comparison and failed personalization hypothesis when discussing the result.

The project now has evidence of an engine improvement over rules. It does not yet have evidence of a novel algorithm beating standard ML. The remaining product work is a versioned model loader and supported-input contract, immutable learned assessment storage, application explanations, and end-to-end import/replay verification under the existing workload limits. Those integration milestones remain distinct from this completed experiment. If further research is pursued, predeclare a new untouched evaluation with adequate online and swipe positives; do not tune against this now-consumed 2019 population or mix differently formatted datasets without a source adapter and domain-specific validation.
