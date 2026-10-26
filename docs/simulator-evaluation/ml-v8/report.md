# Stability repair and stronger fraud models

This is an **exploratory synthetic-data result**, not a new untouched confirmation, a real-bank benchmark, or a runtime release. Prior source exposure is retained in the interpretation. No model was activated.

## What was missing

The source audit independently matched every cached coverage count against all 24,386,900 original CSV rows. The recent fit population includes 74,321 online purchases with zero online fraud labels; first-half 2017 has zero development frauds across channels. Earlier 2016 data represents a different, online-heavy fraud regime. More rows alone did not guarantee representative training examples.

V7 also exposed numerical divergence: EBM logits reached roughly 1e45 and its miner roughly 1e26. Finiteness-only validation missed this. The affected comparison was stopped, preserved and explicitly invalidated. Earlier v4/v5/v6 checks did not show that explosion; their reports remain unchanged. See [v7 failure evidence](../ml-v7/numerical-failure.json).

V8 bounds EBM leaf updates, applies L2 regularization, and rejects nonfinite or extreme finite logits, intercepts and terms before mining/export/evaluation. It never clips a failed model into appearing valid. The stronger EBM also gets more boosting rounds and interactions. Feature ablations use the same stronger settings, rows and seeds.

Rows beginning with '+' are cumulative additions to the stronger EBM: sequence/merchant context, then geography, then delayed feedback, then hard-negative weighting. The selected '+ Hard negatives' model therefore contains that entire feature set. Its small advantage over the feedback model does not establish a statistically significant benefit from weighting alone.

The feature ablations identify geography as a major source of improved precision. In the latest-period first-seed geography/feedback models, prior ZIP familiarity has the largest training-weighted mean absolute term contribution. Delayed merchant fraud counts also appear among the leading terms when available. These descriptive importance values do not establish causality or real-world robustness; see [feature diagnostics](feature-diagnostics.json).

## Full-data follow-through

Pilot-selected challenger: **+ Hard negatives**. The latest-period refit uses all 565,519 eligible training purchases. Evaluation contains 51,889 purchases, 110 frauds and 16 users with fraud. This evaluation was already used in the pilot: it is a descriptive full-data follow-through, not another independent test. Its population and cutoffs differ from the earlier v6 headline.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Repaired baseline EBM | 99.66% | 24.44% | 30.00% | 26.94% | 33 | 102 |
| + Hard negatives | 99.87% | 100.00% | 40.91% | 58.06% | 45 | 0 |
| Soft-history CatBoost | 99.58% | 16.87% | 25.45% | 20.29% | 28 | 138 |

The selected full-data model has average precision 73.99%. At the separate 1% review-budget reference, it achieves 82.73% recall and 17.53% precision. That ranking reference is not a replacement cutoff selected for deployment.

Descriptive paired-user 97.5% difference intervals for the selected challenger:

| Comparator | Precision difference | Recall difference |
| --- | ---: | ---: |
| Soft-history CatBoost | [+70.81, +94.19] pp | [+4.49, +30.77] pp |
| Repaired baseline EBM | [+61.86, +88.97] pp | [-1.30, +26.06] pp |

An additional descriptive merchant-cluster sensitivity against the repaired baseline gives precision difference [+63.36, +86.46] pp and recall difference [-2.44, +25.00] pp. This checks sensitivity to shared merchants; it does not change selection or jointly account for user, merchant and time dependence.

## Three-period pilot comparison

The pooled evaluation has 154,820 purchases, 256 frauds and 42 distinct users with fraud. Every fitting fraud was retained; approximately 100,000 legitimate rows per fold were selected by deterministic hash and inverse-inclusion weighted. All histories and evaluation populations remain complete. Every method averages two seeds. The identical 2016 CatBoost packages were reused after population/weight/hash checks.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Repaired baseline EBM | 99.72% | 26.68% | 38.67% | 31.58% | 99 | 272 |
| Stronger EBM | 99.65% | 20.75% | 38.67% | 27.01% | 99 | 378 |
| + Sequence/merchant context | 99.76% | 32.47% | 44.14% | 37.42% | 113 | 235 |
| + Geography | 99.91% | 92.97% | 46.48% | 61.98% | 119 | 9 |
| + Delayed feedback | 99.91% | 97.52% | 46.09% | 62.60% | 118 | 3 |
| + Hard negatives | 99.91% | 97.64% | 48.44% | 64.75% | 124 | 3 |
| Soft-history CatBoost | 99.46% | 13.51% | 41.80% | 20.42% | 107 | 685 |

All cutoffs maximize complete calibration-quarter precision subject to at least 50% recall, then remain fixed for the following quarter. This buffer does not guarantee 40% future recall. Dates and users remain disjoint between fitting and evaluation; earlier unlabelled history is allowed.

| Period | Method | Precision | Recall | AP | Recall at 1% review | Online found / frauds |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2016Q4 | Repaired baseline EBM | 100.00% | 51.22% | 76.60% | 87.80% | 41 / 69 |
| 2016Q4 | Stronger EBM | 100.00% | 53.66% | 77.86% | 89.02% | 43 / 69 |
| 2016Q4 | + Sequence/merchant context | 92.73% | 62.20% | 81.46% | 92.68% | 50 / 69 |
| 2016Q4 | + Geography | 94.23% | 59.76% | 84.95% | 95.12% | 46 / 69 |
| 2016Q4 | + Delayed feedback | 95.65% | 53.66% | 85.94% | 96.34% | 43 / 69 |
| 2016Q4 | + Hard negatives | 96.23% | 62.20% | 85.79% | 95.12% | 49 / 69 |
| 2016Q4 | Soft-history CatBoost | 100.00% | 51.22% | 75.93% | 92.68% | 42 / 69 |
| 2018Q3 | Repaired baseline EBM | 15.92% | 39.06% | 21.06% | 62.50% | 0 / 0 |
| 2018Q3 | Stronger EBM | 9.06% | 40.62% | 18.21% | 59.38% | 0 / 0 |
| 2018Q3 | + Sequence/merchant context | 14.29% | 46.88% | 21.66% | 68.75% | 0 / 0 |
| 2018Q3 | + Geography | 84.00% | 32.81% | 83.02% | 100.00% | 0 / 0 |
| 2018Q3 | + Delayed feedback | 96.77% | 46.88% | 87.63% | 100.00% | 0 / 0 |
| 2018Q3 | + Hard negatives | 96.67% | 45.31% | 87.77% | 100.00% | 0 / 0 |
| 2018Q3 | Soft-history CatBoost | 6.04% | 51.56% | 20.29% | 50.00% | 0 / 0 |
| 2018Q4 | Repaired baseline EBM | 18.60% | 29.09% | 17.21% | 46.36% | 0 / 33 |
| 2018Q4 | Stronger EBM | 19.86% | 26.36% | 12.65% | 44.55% | 0 / 33 |
| 2018Q4 | + Sequence/merchant context | 38.55% | 29.09% | 23.93% | 51.82% | 0 / 33 |
| 2018Q4 | + Geography | 96.08% | 44.55% | 71.07% | 80.00% | 0 / 33 |
| 2018Q4 | + Delayed feedback | 100.00% | 40.00% | 74.41% | 84.55% | 0 / 33 |
| 2018Q4 | + Hard negatives | 100.00% | 40.00% | 74.57% | 82.73% | 0 / 33 |
| 2018Q4 | Soft-history CatBoost | 15.69% | 29.09% | 15.89% | 40.00% | 0 / 33 |

## Adjusted uncertainty

Paired-user bootstrap with 4,000 draws and 99.1667% intervals for the six comparisons against the repaired baseline (Bonferroni allocation 0.05/6). These are conditional estimates on exposed data; they do not include all training, selection, shared-merchant or temporal uncertainty. Fold results show temporal sensitivity; three periods do not establish broad robustness.

| Candidate | Precision difference | Recall difference | Failed requirements |
| --- | ---: | ---: | --- |
| Soft-history CatBoost | [-19.03, -7.20] pp | [-4.49, +10.03] pp | adjusted_precision, precision_gain, recall_floor |
| + Sequence/merchant context | [-0.08, +11.76] pp | [-2.48, +12.85] pp | adjusted_precision, recall_floor |
| + Delayed feedback | [+61.20, +81.64] pp | [-0.48, +16.13] pp | None |
| + Geography | [+55.97, +77.64] pp | [-0.37, +16.21] pp | recall_floor |
| Stronger EBM | [-9.96, -2.09] pp | [-3.74, +4.11] pp | adjusted_precision, precision_gain, recall_floor |
| + Hard negatives | [+61.34, +81.67] pp | [+1.99, +18.82] pp | None |

Methods passing every exploratory advancement requirement: + Delayed feedback, + Hard negatives.

## Online coverage and reporting delay

The online probe routes only online purchases through the frozen 2016 CatBoost model at its original cutoff. It keeps the selected latest model elsewhere and does not optimize a new cutoff or average incompatible scores.

| Policy | Precision | Recall | Online fraud found | Online false alerts |
| --- | ---: | ---: | ---: | ---: |
| Latest model | 100.00% | 40.91% | 0 / 33 | 0 |
| Older-model online fallback | 98.15% | 48.18% | 8 / 33 | 1 |

Fixed latest-period pilot feedback model/cutoff, alternative delay assumptions:

| Delay | Precision | Recall | F1 |
| --- | ---: | ---: | ---: |
| 14 days | 100.00% | 40.00% | 57.14% |
| 30 days | 100.00% | 40.00% | 57.14% |
| 60 days | 100.00% | 40.00% | 57.14% |

Identical decisions across these three delays are a local sensitivity result; they do not establish robustness to real reporting delays or different periods.

## Verification and remaining limits

Full-data fit resources (two seeds; excludes loading, extraction and replay):

| Method | Fit seconds | Recorded process peak GiB |
| --- | ---: | ---: |
| Soft-history CatBoost | 622.8 | 1.23 |
| Repaired baseline EBM | 45.2 | 0.93 |
| + Hard negatives | 144.5 | 1.23 |

Process peaks include earlier work in the same process; they are not isolated model allocations.

All model fits and scoring pass the numerical health contract. Serialized models reproduce their evaluation scores exactly. See `verification.json` and `reproduction-check.json` for actual completed tests, typing, lint and complete calibration/evaluation replay. A second complete training rebuild was not run.

Merchant geography is not customer GPS. Card/customer snapshots remain excluded. Delayed feedback uses fit-role labels only, with simulated timing; IBM does not supply real reporting dates. Finalized supervised targets do not fully model online training-label maturity or intervention censoring. A new independent labelled source is required for external-validity claims.

No neural sequence encoder was trained. The immediate priority became repairing invalid training and testing information/capacity with a strong conventional comparator. All runtime behavior and protected plans/reminders remain unchanged.

![Rolling precision and recall](rolling-results.png)
