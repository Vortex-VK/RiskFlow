# V14 chronological combiner experiment

The accepted model remains [v13](../accepted-model-v13.json). Selection: **Accepted v13**, route **retained**. No runtime model was activated and no successor was automatically accepted.

Pooled 90% recall / 97% precision attainment: **none**. Attainment in every period: **none**. Calibration precision targets are threshold-selection constraints, not guarantees of future precision.

## Three-period results

Complete natural-prevalence evaluation: 154,820 transactions, 256 frauds, 42 users with fraud. The baseline here uses the existing pilot v13 packages; its latest-quarter result differs from the stronger full accepted package below.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v13 | 99.9548% | 96.50% | 75.39% | 84.65% | 193 | 7 |
| Flat learned combiner / 97% calibration | 99.8857% | 91.58% | 33.98% | 49.57% | 87 | 8 |
| Sequence combiner / 97% calibration | 99.9257% | 95.48% | 57.81% | 72.02% | 148 | 7 |
| Sequence combiner / 99% calibration | 99.9057% | 97.41% | 44.14% | 60.75% | 113 | 3 |
| V13 plus sequence detector | 99.9548% | 96.50% | 75.39% | 84.65% | 193 | 7 |
| V13 plus chip specialist | 99.9548% | 96.50% | 75.39% | 84.65% | 193 | 7 |
| V13 plus both detectors | 99.9548% | 96.50% | 75.39% | 84.65% | 193 | 7 |

The matched sequence-versus-flat comparison changes recall by +23.83 percentage points and precision by +3.90 points. These are descriptive point differences; a separate significance claim for this ablation was not registered. Both combiners use the same training rows and capacity, with the sequence model adding 36 causal history features.

| Candidate | Adjusted recall difference vs v13 | Adjusted precision difference vs v13 | Failed upgrade requirements |
| --- | ---: | ---: | --- |
| Flat learned combiner / 97% calibration | [-53.76, -25.95] pp | [-14.49, +0.54] pp | observed_period_limits, precision97, recall_gain, recall_significance |
| Sequence combiner / 97% calibration | [-30.01, -5.82] pp | [-7.43, +3.01] pp | observed_period_limits, precision97, recall_gain, recall_significance |
| Sequence combiner / 99% calibration | [-41.07, -19.17] pp | [-5.02, +8.67] pp | observed_period_limits, recall_gain, recall_significance |
| V13 plus sequence detector | [+0.00, +0.00] pp | [+0.00, +0.00] pp | precision97, recall_gain, recall_significance |
| V13 plus chip specialist | [+0.00, +0.00] pp | [+0.00, +0.00] pp | precision97, recall_gain, recall_significance |
| V13 plus both detectors | [+0.00, +0.00] pp | [+0.00, +0.00] pp | precision97, recall_gain, recall_significance |

Intervals use 4,000 paired user-cluster resamples and confidence 1 - 0.05 / 34, accounting for 28 prior and six current comparisons. This correction does not remove adaptive reuse of these exposed cohorts. Zero intervals for identical policies are not evidence of an improvement.

## Where the decisions change

| Candidate | Newly caught fraud | Previously caught fraud lost | New false alerts | Previous false alerts removed |
| --- | ---: | ---: | ---: | ---: |
| Flat learned combiner / 97% calibration | 3 | 109 | 3 | 2 |
| Sequence combiner / 97% calibration | 11 | 56 | 4 | 4 |
| Sequence combiner / 99% calibration | 5 | 85 | 2 | 6 |
| V13 plus sequence detector | 0 | 0 | 0 | 0 |
| V13 plus chip specialist | 0 | 0 | 0 | 0 |
| V13 plus both detectors | 0 | 0 | 0 | 0 |

| Period | V13 calibration precision | Add sequence cutoff | Add chip cutoff | Combined chip cutoff |
| --- | ---: | ---: | ---: | ---: |
| 2016Q4 | 100.00% | None | None | None |
| 2018Q3 | 98.80% | None | None | None |
| 2018Q4 | 98.31% | None | None | None |

`None` means no threshold satisfied all joint calibration requirements, including at least five incremental fraud detections, no calibration accuracy loss and at least 97% combined precision. It causes the additive policy to retain the incumbent. It does not establish that the standalone chip model has no predictive signal. Here incumbent calibration precision already exceeded 97% in every period, so the failure was finding enough supported additional detections within the remaining false-alert budget.

## Each period

### 2016Q4

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v13 | 99.9549% | 94.03% | 76.83% | 84.56% | 63 | 4 |
| Flat learned combiner / 97% calibration | 99.9431% | 92.06% | 70.73% | 80.00% | 58 | 5 |
| Sequence combiner / 97% calibration | 99.9490% | 93.75% | 73.17% | 82.19% | 60 | 4 |
| Sequence combiner / 99% calibration | 99.9529% | 96.77% | 73.17% | 83.33% | 60 | 2 |
| V13 plus sequence detector | 99.9549% | 94.03% | 76.83% | 84.56% | 63 | 4 |
| V13 plus chip specialist | 99.9549% | 94.03% | 76.83% | 84.56% | 63 | 4 |
| V13 plus both detectors | 99.9549% | 94.03% | 76.83% | 84.56% | 63 | 4 |

### 2018Q3

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v13 | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| Flat learned combiner / 97% calibration | 99.9173% | 88.89% | 37.50% | 52.75% | 24 | 3 |
| Sequence combiner / 97% calibration | 99.9404% | 92.31% | 56.25% | 69.90% | 36 | 3 |
| Sequence combiner / 99% calibration | 99.9288% | 96.55% | 43.75% | 60.22% | 28 | 1 |
| V13 plus sequence detector | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| V13 plus chip specialist | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| V13 plus both detectors | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |

### 2018Q4

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v13 | 99.9422% | 98.78% | 73.64% | 84.38% | 81 | 1 |
| Flat learned combiner / 97% calibration | 99.7976% | 100.00% | 4.55% | 8.70% | 5 | 0 |
| Sequence combiner / 97% calibration | 99.8882% | 100.00% | 47.27% | 64.20% | 52 | 0 |
| Sequence combiner / 99% calibration | 99.8362% | 100.00% | 22.73% | 37.04% | 25 | 0 |
| V13 plus sequence detector | 99.9422% | 98.78% | 73.64% | 84.38% | 81 | 1 |
| V13 plus chip specialist | 99.9422% | 98.78% | 73.64% | 84.38% | 81 | 1 |
| V13 plus both detectors | 99.9422% | 98.78% | 73.64% | 84.38% | 81 | 1 |

## Full accepted-model reference

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v13 / full latest cohort | 99.9537% | 98.86% | 79.09% | 87.88% | 87 | 1 |

No challenger improved pooled recall, so the frozen selection retained v13 and no full-incumbent follow-through was run.

The full reference has 51,889 transactions, 110 frauds and 16 users with fraud. Reaching 90% recall and 97% precision on it requires at least 99 true positives; at exactly 99 true positives at most three false positives are allowed. V13 has 87 true positives and one false positive, so that operating point needs twelve additional detections with at most two additional false alerts. Accuracy alone is not a useful discriminator at this prevalence.

## Interpretation and next experiment

This bounded experiment tests three ideas: a learned replacement combiner, strictly causal account score histories, and a chip specialist trained with extra weight on hard legitimate examples. It does not test a production delayed-label retraining loop. Current 2018 stacking blocks have no online fraud labels; older 2016 examples supply all online-fraud supervision. This gap limits what recent online behavior can teach the second stage.

The chronological split also gives the base experts only three months of fitting history, leaving the next three months for second-stage training. This is a tradeoff against v13's established training recipe, not a controlled proof that stacking itself is inferior. Historical and current stacking blocks use different chronologically valid base fits, so score distribution drift is another plausible limitation. These explanations are hypotheses, not isolated causal findings.

A next experiment should first audit older IBM training periods for additional distinct online-fraud episodes and build multiple forward-only stacking blocks. Preserve a substantial base training history, include channel-specific experts, and measure whether newly recovered fraud outweighs detections lost by the combiner. Freeze that experiment before reading evaluation outcomes. Avoid simply relaxing thresholds: the observed results already show that 97% calibration precision may fail to transfer. Independent later data would be needed to substantiate generalization after this many rounds of cohort reuse; matching or adapting another dataset's schema alone would not solve distribution differences.

## Architecture, validation and reproduction

The [design](design.md) and [frozen protocol](protocol.json) describe fitting, negative sampling weights, historical expert reuse, calibration and selection. All second-stage training predictions come from models fitted strictly earlier. Sequence histories use complete eligible transaction streams before sampling, exclude equal-time peers, and use no fraud labels. Users are disjoint between fitting and validation roles. Original merchant feedback retains its declared 30-day delay assumption; the general retrospective training labels have no actual reporting timestamps, so a complete live label-maturity simulation is not claimed.

Fitted 16 distinct model packages with one predeclared seed and two threads: 512.7 total model-fitting seconds; maximum reported training process peak 1.343 GiB. This excludes feature construction and verification time. Single-seed training variance was not measured. Models and row-level records stay under ignored `training_data/ml-v14`; this report contains aggregate information only.

Verification is recorded in [reproduction-check.json](reproduction-check.json) and [verification.json](verification.json): serialized model-score replay, independent direct-calculation sequence histories, fitting identities/weights/chronology, policy and metric replay, statistical interval reproduction, negative-control tests, typing and formatting. This is an inference replay, not a second complete training rebuild.

From the repository root:

```powershell
backend/.venv/Scripts/python.exe scripts/verify_ml_v14.py
backend/.venv/Scripts/python.exe scripts/report_ml_v14.py
```

The original training command was `python -m ml_v14.pipeline run` from `backend`. It intentionally refuses to overwrite existing artifacts. Plans, personal reminders, earlier experiments and accepted v13 packages remain unchanged.
