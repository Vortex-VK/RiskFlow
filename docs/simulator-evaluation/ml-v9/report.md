# Recall improvement with precision and accuracy constraints

This is an **exploratory historical IBM experiment** on previously exposed synthetic data. Thresholds are selected using preceding calibration periods and frozen before evaluation scoring is joined to outcomes. These mechanics do not make this repeatedly used source an untouched confirmation. No runtime model was activated.

## Latest-period full-data result

Selected method: **Full-feature CatBoost**. Pilot selection route: `preserved`. Full-data acceptance: **passed**.

The identical evaluation population contains 51,889 purchases, 110 frauds and 16 users with fraud. The v8 full-data incumbent and its original cutoff are unchanged. This full-data follow-through uses the same latest evaluation as the pilot and remains descriptive.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V8 incumbent | 99.87% | 100.00% | 40.91% | 58.06% | 45 | 0 |
| Full-feature CatBoost | 99.90% | 100.00% | 54.55% | 70.59% | 60 | 0 |

Relative to the incumbent: 17 newly detected frauds, 2 lost detections, 0 added false alerts and 0 removed false alerts.

| Uncertainty grouping | Recall difference, 95% interval | Precision difference, 95% interval |
| --- | ---: | ---: |
| Customer | [+4.60, +25.46] pp | [+0.00, +0.00] pp |
| Merchant sensitivity | [+7.08, +20.43] pp | [+0.00, +0.00] pp |

Full-data requirements: defined: pass; observed_preservation: pass; precision_noninferiority: pass; recall_gain: pass; recall_significance: pass.

Observed 100% precision, if present, means no false alerts in this finite sample. A bootstrap of a sample with zero false alerts cannot estimate the chance of unseen false-alert modes; a degenerate precision interval is not proof of perfect future precision. Merchant resampling is a separate sensitivity, not a joint treatment of customer, merchant and time dependence.

| Channel | Policy | Fraud found / total | False alerts | Precision | Recall |
| --- | --- | ---: | ---: | ---: | ---: |
| Chip Transaction | V8 incumbent | 40 / 67 | 0 | 100.00% | 59.70% |
| Online Transaction | V8 incumbent | 0 / 33 | 0 | undefined | 0.00% |
| Swipe Transaction | V8 incumbent | 5 / 10 | 0 | 100.00% | 50.00% |
| Chip Transaction | Full-feature CatBoost | 54 / 67 | 0 | 100.00% | 80.60% |
| Online Transaction | Full-feature CatBoost | 0 / 33 | 0 | undefined | 0.00% |
| Swipe Transaction | Full-feature CatBoost | 6 / 10 | 0 | 100.00% | 60.00% |

## Small-scale comparison

Three disjoint evaluation periods contain 154,820 purchases, 256 frauds and 42 distinct users with fraud. Training uses the same deterministic v8 negative samples with inverse inclusion weights and all frauds. Histories and evaluation populations are complete. Every learned score averages the same two seeds.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V8 incumbent | 99.91% | 97.64% | 48.44% | 64.75% | 124 | 3 |
| Global recall policy (100%) | 99.89% | 96.91% | 36.72% | 53.26% | 94 | 3 |
| Global recall policy (98%) | 99.90% | 96.49% | 42.97% | 59.46% | 110 | 4 |
| Channel recall policies | 99.90% | 97.00% | 37.89% | 54.49% | 97 | 3 |
| Three-EBM ensemble | 99.90% | 96.19% | 39.45% | 55.96% | 101 | 4 |
| Causal burst follow-up | 99.93% | 97.47% | 60.16% | 74.40% | 154 | 4 |
| EBM online specialist | 99.91% | 96.95% | 49.61% | 65.63% | 127 | 4 |
| Full-feature CatBoost | 99.92% | 98.55% | 53.12% | 69.04% | 136 | 2 |
| CatBoost + online specialist | 99.92% | 97.84% | 53.12% | 68.86% | 136 | 3 |
| Fraud-weighted EBM + specialist | 99.89% | 96.04% | 37.89% | 54.34% | 97 | 4 |

Policy names with 100% or 98% refer to empirical **calibration targets**, not promised evaluation precision. Channel cutoffs require sufficient positives and alerts; unsupported channels inherit that model's global cutoff. Infeasible global policies abstain. The 98% method is a tradeoff diagnostic and receives no relaxed evaluation gate.

| Candidate | Recall difference, adjusted interval | Precision difference, adjusted interval | Failed requirements |
| --- | ---: | ---: | --- |
| Global recall policy (100%) | [-18.47, -5.27] pp | [-2.34, +0.00] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Global recall policy (98%) | [-11.17, -0.42] pp | [-4.72, +0.00] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Channel recall policies | [-17.10, -4.01] pp | [-2.21, +0.00] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Three-EBM ensemble | [-16.00, -2.30] pp | [-5.29, +0.00] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Causal burst follow-up | [+5.38, +18.35] pp | [-2.14, +1.05] pp | observed_preservation, precision_noninferiority |
| EBM online specialist | [-4.48, +6.38] pp | [-3.84, +0.48] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Full-feature CatBoost | [-2.52, +13.72] pp | [-2.71, +5.04] pp | precision_noninferiority, recall_gain, recall_significance |
| CatBoost + online specialist | [-3.98, +12.88] pp | [-3.08, +3.63] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |
| Fraud-weighted EBM + specialist | [-18.76, -1.44] pp | [-5.85, +0.00] pp | observed_preservation, precision_noninferiority, recall_gain, recall_significance |

Methods passing all pilot requirements: **none**.

Intervals use 4,000 paired customer resamples and 99.4444% confidence (Bonferroni allocation 0.05/9). They are conditional on the exposed data, fitted models and selected policies; they do not eliminate repeated-experiment selection bias. Advancement requires at least a ten-point pooled recall gain, positive adjusted recall lower bound, precision-difference lower bound above minus two points, and no observed precision, accuracy or recall regression in any period. The uncertainty margin does not permit an observed precision loss.

| Period | Method | Precision | Recall | False alerts |
| --- | --- | ---: | ---: | ---: |
| 2016Q4 | V8 incumbent | 96.23% | 62.20% | 2 |
| 2016Q4 | Global recall policy (100%) | 96.23% | 62.20% | 2 |
| 2016Q4 | Global recall policy (98%) | 94.55% | 63.41% | 3 |
| 2016Q4 | Channel recall policies | 96.23% | 62.20% | 2 |
| 2016Q4 | Three-EBM ensemble | 94.34% | 60.98% | 3 |
| 2016Q4 | Causal burst follow-up | 96.61% | 69.51% | 2 |
| 2016Q4 | EBM online specialist | 95.92% | 57.32% | 2 |
| 2016Q4 | Full-feature CatBoost | 96.36% | 64.63% | 2 |
| 2016Q4 | CatBoost + online specialist | 95.83% | 56.10% | 2 |
| 2016Q4 | Fraud-weighted EBM + specialist | 95.92% | 57.32% | 2 |
| 2018Q3 | V8 incumbent | 96.67% | 45.31% | 1 |
| 2018Q3 | Global recall policy (100%) | 93.33% | 21.88% | 1 |
| 2018Q3 | Global recall policy (98%) | 96.67% | 45.31% | 1 |
| 2018Q3 | Channel recall policies | 94.12% | 25.00% | 1 |
| 2018Q3 | Three-EBM ensemble | 90.91% | 15.62% | 1 |
| 2018Q3 | Causal burst follow-up | 95.12% | 60.94% | 2 |
| 2018Q3 | EBM online specialist | 96.67% | 45.31% | 1 |
| 2018Q3 | Full-feature CatBoost | 100.00% | 51.56% | 0 |
| 2018Q3 | CatBoost + online specialist | 100.00% | 51.56% | 0 |
| 2018Q3 | Fraud-weighted EBM + specialist | 93.75% | 23.44% | 1 |
| 2018Q4 | V8 incumbent | 100.00% | 40.00% | 0 |
| 2018Q4 | Global recall policy (100%) | 100.00% | 26.36% | 0 |
| 2018Q4 | Global recall policy (98%) | 100.00% | 26.36% | 0 |
| 2018Q4 | Channel recall policies | 100.00% | 27.27% | 0 |
| 2018Q4 | Three-EBM ensemble | 100.00% | 37.27% | 0 |
| 2018Q4 | Causal burst follow-up | 100.00% | 52.73% | 0 |
| 2018Q4 | EBM online specialist | 98.08% | 46.36% | 1 |
| 2018Q4 | Full-feature CatBoost | 100.00% | 45.45% | 0 |
| 2018Q4 | CatBoost + online specialist | 98.28% | 51.82% | 1 |
| 2018Q4 | Fraud-weighted EBM + specialist | 97.22% | 31.82% | 1 |

## Implementation and limits

The reusable policy engine separates precision-constrained threshold selection, per-channel inference, specialist routing and causal burst follow-up. Burst follow-up uses only strictly earlier original predicted alerts on the same instrument account. Equal-time alerts cannot propagate, propagated alerts cannot seed a chain, and neither future fraud labels nor evaluation outcomes enter its state. Each calibration/evaluation interval starts with empty propagation state.

The online expert is a stabilized full-feature EBM fitted only on 2016H1 online purchases, including both legitimate purchases and frauds. Its calibration combines 2016Q3 online examples and current calibration-quarter examples, deduplicated. All fitting rows precede every calibration row. Recent legitimate online calibration rows constrain transfer; no recent model is calibrated backwards on historical data. Nevertheless, the historical source cannot guarantee coverage of new online fraud types.

CatBoost receives all v8 features, 500 trees, depth six and L2=10. The alternative EBM receives fraud weight four and ordinary negative inclusion weights. Both retain the same strictly prior geography, context and delayed merchant-feedback semantics. Assumed reporting delay remains 30 days; the source supplies no real reporting timestamps. Geographic fields describe merchants, not customer GPS. Scores remain uncalibrated model scores.

No neural model or new external dataset was introduced. Earlier source/code/report artifacts, plan.md, todo.md and the ML plan remain unchanged. Raw and derived rows stay under ignored training_data. The application continues using its existing runtime behavior.

See [verification](verification.json), [exact replay](reproduction-check.json), [design](design.md) and [reproduction instructions](reproduction.md). Replay validates saved model scores, policy selection, decisions, metrics and uncertainty; it is not a second complete training rebuild.

![Recall and precision across periods](comparison.png)
