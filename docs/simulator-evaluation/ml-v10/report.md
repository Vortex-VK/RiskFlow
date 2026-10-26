# Recall improved; preservation must be judged across periods

Overall strict acceptance: **failed**. This report includes the initial nine-method experiment and a separately frozen three-method follow-up. Every outcome is exploratory on previously exposed synthetic IBM history. No automatic application or offline-champion replacement was made.

## Full-data latest-period follow-through

The follow-up selected **Combined rescue** before full-data policy evaluation, through the `tradeoff` route. Its latest-period full-data gate **passed**. This does not override a failed cross-period pilot gate.

All rows below use the same 51,889 purchases and 110 frauds across 16 users with fraud. The comparison uses the frozen v8 full EBM and a two-seed full-feature CatBoost fitted on all 565,519 eligible recent training purchases. Policies use preceding calibration data. The latest evaluation was already consumed in earlier work and the pilot.

| Policy | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Previous EBM | 99.87% | 100.00% | 40.91% | 58.06% | 45 | 0 |
| Full-feature CatBoost | 99.90% | 100.00% | 54.55% | 70.59% | 60 | 0 |
| Combined rescue | 99.92% | 100.00% | 60.00% | 75.00% | 66 | 0 |

The selected rescue preserves every original alert and adds **21 fraud detections and 0 false alerts** in this period. Remaining missed frauds: 44.

| Grouping | Recall difference, 95% interval | Precision difference, 95% interval |
| --- | ---: | ---: |
| Customer | [+8.06, +31.51] pp | [+0.00, +0.00] pp |
| Merchant sensitivity | [+11.54, +26.67] pp | [+0.00, +0.00] pp |

Full-data checks: defined: pass; observed_preservation: pass; precision_noninferiority: pass; recall_gain: pass; recall_significance: pass.

Zero observed false alerts, if present, does not establish perfect future precision. Resampling a zero-false-alert sample cannot expose unseen failure modes. The small positive-user count and shared synthetic source limit generalization.

## Three-period evidence and tradeoffs

Common population: 154,820 purchases, 256 frauds and 42 distinct users with fraud.

| Policy | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Previous EBM | 99.91% | 97.64% | 48.44% | 64.75% | 124 | 3 |
| Full-feature CatBoost | 99.92% | 98.55% | 53.12% | 69.04% | 136 | 2 |
| Uncorroborated burst follow-up | 99.93% | 97.47% | 60.16% | 74.40% | 154 | 4 |
| Corroborated burst | 99.93% | 97.47% | 60.16% | 74.40% | 154 | 4 |
| Cross-model rescue | 99.93% | 97.42% | 58.98% | 73.48% | 151 | 4 |
| Combined rescue | 99.94% | 97.08% | 64.84% | 77.75% | 166 | 5 |

| Follow-up | Recall difference, adjusted interval | Precision difference, adjusted interval | Failed requirements |
| --- | ---: | ---: | --- |
| Corroborated burst | [+5.01, +18.57] pp | [-2.30, +1.06] pp | observed_preservation, precision_noninferiority |
| Cross-model rescue | [+5.15, +17.78] pp | [-2.97, +1.19] pp | observed_preservation, precision_noninferiority |
| Combined rescue | [+9.14, +23.71] pp | [-3.52, +1.19] pp | observed_preservation, precision_noninferiority |

The follow-up uses 4,000 paired-customer bootstrap draws and 99.5833% intervals, allocating 0.05/12 across the nine initial and three follow-up comparisons. This conservative allocation does not remove adaptive hypothesis selection, repeated-source exposure or training uncertainty. Merchant sensitivity is separate, not a joint customer/merchant/time variance estimate.

The strict rule requires at least ten percentage points more pooled recall, a positive adjusted recall-gain lower bound, no observed precision/accuracy/recall regression in any period, and a precision-difference lower bound above minus two points. Tiny observed precision losses still fail this rule; no margin was relaxed after seeing outcomes.

## What worked and what failed

The initial experiment compared global and channel precision-constrained cutoffs, a three-EBM score ensemble, causal burst follow-up, a historical online specialist, full-feature CatBoost and fraud-upweighted EBM variants. Stricter calibration precision targets often reduced recall without improving evaluation precision. An online expert could not reliably replace an existing strong online detector across regimes. The full-feature CatBoost offered complementary detections, but its standalone pilot recall gain did not meet the ten-point/significance gate. See the complete [initial comparison](../ml-v9/report.md).

The targeted follow-up retains every incumbent alert and seeks additional alerts using corroborating scores. Burst rescue checks only later suspicious transactions on the same instrument account, seeded by original predicted alerts. Cross-model rescue checks CatBoost alerts against a separately selected incumbent-score cutoff. Their union covers more missed fraud. Each additional cutoff is chosen only on calibration data with at least five additional correct alerts and zero additional calibration false alerts. Whole ties are respected; unsupported rescues abstain. Neither true labels nor rescued alerts update inference state.

The corroboration check did not eliminate the pilot burst method's additional false alert. Combining the policies improved recall further but added false alerts in the earlier periods. Those losses are retained in this report rather than hidden behind the latest period's result.

## Remaining coverage

| Channel | Policy | Fraud found / total | False alerts |
| --- | --- | ---: | ---: |
| Chip Transaction | V8 incumbent | 40 / 67 | 0 |
| Chip Transaction | Combined rescue | 56 / 67 | 0 |
| Online Transaction | V8 incumbent | 0 / 33 | 0 |
| Online Transaction | Combined rescue | 0 / 33 | 0 |
| Swipe Transaction | V8 incumbent | 5 / 10 | 0 |
| Swipe Transaction | Combined rescue | 10 / 10 | 0 |

Recent training/calibration has no positive online examples, while the latest evaluation contains 33 online frauds. The new rescue does not manufacture missing online evidence. Representative online fraud and genuinely independent evaluation remain priorities. More historical synthetic tuning cannot establish preservation on a future bank population.

## Delivery and verification

Reusable inference and calibration policies are implemented under backend/ml_v9 and backend/ml_v10; the same functions generate and replay decisions. The numerical-health contract, immutable source/model hashes, chronology checks, account isolation, same-time exclusion and nonrecursive propagation remain enforced. Existing plans/reminders, v1-v8 artifacts and application behavior are unchanged. No neural network, external data or new dependency was added.

See [verification](verification.json), [exact replay](reproduction-check.json), [frozen design](design.md), and [reproduction](reproduction.md). Exact model-score replay is supplied by the v9 verifier; the follow-up verifies score provenance and independently replays selection, decisions, metrics and intervals. A second training rebuild was not performed.

![Recall and precision by period](comparison.png)
