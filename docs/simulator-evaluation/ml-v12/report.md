# Recall improves with one additional false alert

The v12 combined candidate passed the predeclared pilot and full-model descriptive gates. The user-selected [v10 model is preserved](../accepted-model-v10.json), with its exact weights and policies. V12 is saved as a validated offline challenger; the accepted pointer remains v10. No application model was activated.

## Latest period, full incumbent models

Same 51,889 purchases, 110 frauds and 16 users with fraud. All v10 alerts are retained. The challenger adds **18 correct detections and one false alert**: recall improves **16.36 percentage points**, precision falls **1.18 points**, accuracy improves **0.0328 points**, and missed fraud falls from 44 to 26 (40.91% fewer misses).

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v10 | 99.9152% | 100.00% | 60.00% | 75.00% | 66 | 0 |
| Combined v12 | 99.9480% | 98.82% | 76.36% | 86.15% | 84 | 1 |

The latest incumbent uses its full recent training population. The two historical specialists deliberately retain their original deterministic pilot training populations; this experiment changes routing and causal follow-up, without retraining or requesting external data. The latest cohort has already been used in previous experiments and the pilot; this comparison is descriptive, not independent confirmation.

## Three-period comparison

Common population: 154,820 purchases, 256 frauds and 42 distinct users with fraud. The combined candidate adds **22 correct detections and one false alert**, increasing recall **8.59 points**, reducing precision **0.17 points**, and increasing accuracy **0.0136 points**.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v10 | 99.9386% | 97.08% | 64.84% | 77.75% | 166 | 5 |
| Online CatBoost plus recent follow-up | 99.9457% | 96.74% | 69.53% | 80.91% | 178 | 6 |
| Combined v12 | 99.9522% | 96.91% | 73.44% | 83.56% | 188 | 6 |
| Corroborated online episode | 99.9496% | 96.84% | 71.88% | 82.51% | 184 | 6 |

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2016Q4 / Accepted v10 | 99.9509% | 95.24% | 73.17% | 82.76% | 60 | 3 |
| 2016Q4 / Combined v12 | 99.9529% | 95.31% | 74.39% | 83.56% | 61 | 3 |
| 2018Q3 / Accepted v10 | 99.9615% | 95.83% | 71.88% | 82.14% | 46 | 2 |
| 2018Q3 / Combined v12 | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| 2018Q4 / Accepted v10 | 99.9036% | 100.00% | 54.55% | 70.59% | 60 | 0 |
| 2018Q4 / Combined v12 | 99.9364% | 98.73% | 70.91% | 82.54% | 78 | 1 |

These pilot results use smaller recent-model training samples than the full latest comparison. They are different model fits on the same latest evaluation rows; do not pool the full comparison with the pilot as additional independent evidence.

## What changed

1. Preserve the accepted EBM/CatBoost combined detector and every one of its alerts.
2. Add a historical CatBoost trained when online fraud examples existed. Its threshold uses historical plus recent preceding calibration, with zero false alerts allowed on recent calibration negatives.
3. Use its initial online alerts to identify an account episode. A later online transaction must remain sufficiently suspicious to that same CatBoost and pass a separately calibrated historical EBM cutoff. New alerts cannot extend the episode recursively.
4. Combine that online extension with the bounded v11 recent-account follow-up. Each policy uses its own fixed seed set; they do not seed each other.

For the full latest period, calibration selected a 24-hour online window and a CatBoost margin of eight raw-score units. The historical EBM supplies corroboration. Its cutoff is a raw model score, not a fraud probability. The recent-account extension abstains in the full latest fit because it lacks sufficient incremental calibration support. The standalone online CatBoost contributes eight correct detections and one false alert; online episode corroboration adds another ten correct detections and zero false alerts.

The [initial six-method round](../ml-v11/report.md) failed its gate. This separate three-method follow-up keeps the same practical thresholds. Simply combining both specialists added a false alert without finding more fraud; the selected policy avoids that union. The online episode by itself failed the adjusted pooled recall significance requirement. The combination passes by also recovering fraud in earlier periods. Complete successes and failures are retained in [results.json](results.json).

## Remaining coverage and uncertainty

| Channel | V10 fraud found / total | V12 fraud found / total | V12 false alerts |
| --- | ---: | ---: | ---: |
| Chip Transaction | 56 / 67 | 56 / 67 | 0 |
| Online Transaction | 0 / 33 | 18 / 33 | 1 |
| Swipe Transaction | 10 / 10 | 10 / 10 | 0 |

Online recall rises from 0% to **54.55%**. Online-only precision is **94.74%** (18 correct out of 19 alerts), lower than the overall 98.82%. The remaining 26 misses comprise 15 online and 11 chip purchases. The 18 newly detected frauds span only **4 users**. More representative online examples and independent validation remain necessary for stronger generalization claims.

| Comparison | Recall difference interval | Precision difference interval |
| --- | ---: | ---: |
| Pooled customer, adjusted 99.7619% | [+0.82, +17.98] pp | [-3.11, +1.34] pp |
| Full latest customer, 95% | [+3.05, +29.63] pp | [-4.55, +0.00] pp |
| Full latest merchant sensitivity, 95% | [+9.35, +25.56] pp | [-4.23, +0.00] pp |

All intervals use 4,000 paired cluster bootstrap draws. The pooled confidence allocates 0.05/21 across the twelve v9/v10, six v11 and three v12 candidate comparisons. This allocation does not remove repeated-source exposure, adaptive follow-up selection, earlier historical tuning or training uncertainty. Merchant sensitivity is separate from customer resampling, not a joint dependence model. Zero observed false alerts for v10 cannot establish perfect future precision.

The observed precision costs satisfy the limits frozen before this round: at most two points in any period and one point pooled; accuracy must not decline. **Statistical precision noninferiority is not established:** the full customer interval permits a precision loss up to 4.55 points, and the adjusted pooled interval permits up to 3.11 points. Passing the observed tradeoff gate must not be described as a guarantee of preserved future precision. These gates differ deliberately from the older strict v10 gate following the user's acceptance of that model and request for minimum loss.

## Verification and reuse

276 backend tests passed; strict typing passed for 120 sources. Ruff and formatting checks cover the new implementation, tests and runners. Negative controls cover tied cutoffs, absent calibration support, recent negative guards, temporal direction, equal timestamps, account isolation, channel routing, finite scores, nonrecursive propagation, and precision/accuracy tradeoff enforcement.

Exact replay covers 154,820 v11 rows and 206,709 v12 rows, including full follow-through. The historical model scores, calibration selections, saved alerts, metrics, channel counts and intervals reproduce. A separate causal decision calculator agrees on every row. Existing incumbent score replay is anchored to its frozen v9 verifier. No new model training or second training rebuild was performed.

Prior experiment sources and reports, plan.md, todo.md and RiskFlow_ML_Implementation_Plan.md match their pre-run hashes. The raw source and old model packages were read only. See [verification](verification.json), [replay](reproduction-check.json), [reproduction instructions](reproduction.md), [frozen design](design.md), and [offline challenger record](../candidate-model-v12.json).

![Recall and precision comparison](comparison.png)
