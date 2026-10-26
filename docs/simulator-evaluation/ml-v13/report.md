# No challenger cleared both upgrade gates

V12 is now explicitly [user accepted](../accepted-model-v12.json), and [current-model.json](../current-model.json) points to its exact frozen model and policy. V10 remains available for rollback. This experiment does not activate an application model or automatically accept a successor.

Seven candidates were defined before evaluation. Pilot selection: **Online CatBoost depth 6**, through the **descriptive** route. Both pilot and full gates must pass to call a candidate a qualified upgrade. Better point estimates alone do not override the gate.

## Three-period pilot comparison

Same 154,820 transactions, 256 frauds and 42 users with fraud. Every candidate preserves all v12 alerts.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v12 | 99.9522% | 96.91% | 73.44% | 83.56% | 188 | 6 |
| Online CatBoost depth 4 | 99.9528% | 96.92% | 73.83% | 83.81% | 189 | 6 |
| Online CatBoost depth 6 | 99.9548% | 96.50% | 75.39% | 84.65% | 193 | 7 |
| Online CatBoost depth 8 | 99.9528% | 96.92% | 73.83% | 83.81% | 189 | 6 |
| Six-model online ensemble | 99.9535% | 96.00% | 75.00% | 84.21% | 192 | 8 |
| EBM-seeded online episode | 99.9516% | 96.41% | 73.44% | 83.37% | 188 | 7 |
| Extended CatBoost episode | 99.9522% | 96.91% | 73.44% | 83.56% | 188 | 6 |
| Ensemble plus both episode policies | 99.9528% | 95.52% | 75.00% | 84.03% | 192 | 9 |

| Candidate | Adjusted recall difference | Adjusted precision difference | Failed pilot requirements |
| --- | ---: | ---: | --- |
| Online CatBoost depth 4 | [+0.00, +2.23] pp | [+0.00, +0.17] pp | recall_gain, recall_significance |
| Online CatBoost depth 6 | [+0.00, +5.95] pp | [-2.87, +0.40] pp | recall_gain, recall_significance |
| Online CatBoost depth 8 | [+0.00, +2.23] pp | [+0.00, +0.17] pp | recall_gain, recall_significance |
| Six-model online ensemble | [+0.00, +5.52] pp | [-3.89, +0.22] pp | recall_gain, recall_significance |
| EBM-seeded online episode | [+0.00, +0.00] pp | [-3.07, +0.00] pp | observed_period_limits, observed_pooled_limits, recall_gain, recall_significance |
| Extended CatBoost episode | [+0.00, +0.00] pp | [+0.00, +0.00] pp | recall_gain, recall_significance |
| Ensemble plus both episode policies | [+0.00, +5.52] pp | [-5.03, +0.21] pp | observed_period_limits, observed_pooled_limits, recall_gain, recall_significance |

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2016Q4 / Accepted v12 | 99.9529% | 95.31% | 74.39% | 83.56% | 61 | 3 |
| 2016Q4 / Online CatBoost depth 6 | 99.9549% | 94.03% | 76.83% | 84.56% | 63 | 4 |
| 2018Q3 / Accepted v12 | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| 2018Q3 / Online CatBoost depth 6 | 99.9673% | 96.08% | 76.56% | 85.22% | 49 | 2 |
| 2018Q4 / Accepted v12 | 99.9364% | 98.73% | 70.91% | 82.54% | 78 | 1 |
| 2018Q4 / Online CatBoost depth 6 | 99.9422% | 98.78% | 73.64% | 84.38% | 81 | 1 |

## Latest full-incumbent follow-through

Same 51,889 transactions and 110 frauds across 16 users with fraud. The selected candidate is frozen before this comparison. The incumbent uses its full recent models; the new specialists retain the same historical pilot training population. These latest evaluation rows overlap the pilot and earlier experiments. This is descriptive follow-through, not independent confirmation.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v12 | 99.9480% | 98.82% | 76.36% | 86.15% | 84 | 1 |
| Online CatBoost depth 6 | 99.9537% | 98.86% | 79.09% | 87.88% | 87 | 1 |

Relative to accepted v12: 3 additional correct detections, 0 additional false alerts, +2.73 percentage points recall and +0.04 points precision. Full descriptive gate: **failed**.

Customer 95% recall-difference interval: [+0.00, +7.19] pp; precision-difference interval: [+0.00, +0.23] pp. Merchant sensitivity recall interval: [+0.00, +6.25] pp.

| Channel | V12 fraud found / total | Candidate fraud found / total | Candidate false alerts |
| --- | ---: | ---: | ---: |
| Chip Transaction | 56 / 67 | 56 / 67 | 0 |
| Online Transaction | 18 / 33 | 21 / 33 | 1 |
| Swipe Transaction | 10 / 10 | 10 / 10 | 0 |


## Methods and training

Train three online-specific CatBoost models at depths 4/6/8, each with two seeds, 500 trees, learning rate .06 and L2=10. All use the existing full history/context/geography/delayed-feedback feature set and exactly the same historical online fitting population as the prior online EBM: **14,010 rows and 1,035 frauds**, across 331 users with fraud. All fraud examples are retained; negatives use inverse sampling weights. Training stays in 2016H1, before every calibration period. No additional source or reserved evaluation labels were opened.

Each model and the six-model equal-score ensemble can add high-confidence online seeds and corroborated account follow-up. Other candidates reverse the two historical specialists' seeding/corroboration roles, or extend the original historical CatBoost's score margin and time window. The fixed combined candidate unions the ensemble, reciprocal and extended policies. Raw scores are model-specific uncalibrated scores, not probabilities. No different model families' scores are averaged.

Historical plus current preceding online calibration is deduplicated. Seed cutoffs require at least ten calibration frauds and five detections, with 100% empirical precision and zero current false alerts. Episode selection requires at least five incremental correct detections and zero false additions beyond both the accepted historical-online component and new seeds. Recent models are never scored backward on 2016 calibration. Rescued alerts cannot recursively extend episodes. Equal-time transactions, other accounts and non-online seeds cannot initiate these new online rescues. All v12 detections remain intact.

Total recorded training time across six fits: **279.6 seconds**. Largest recorded training-process peak resident memory: **0.84 GiB**, within the existing 2.5 GiB budget. These are local training measurements, not production latency measurements. No second independent training rebuild was performed.

## Interpretation and limitations

The depth-6 specialist gives the largest observed improvement: five additional frauds and one additional false alert across periods. Depths 4 and 8 each add only one fraud and no false alerts. The ensemble adds four frauds and two false alerts, so it does not improve on depth 6. Reciprocal seeding adds a false alert without another detection; the extended-window policy makes no additional detections. The fixed union adds three false alerts for four detections and exceeds the precision-loss limits. These results favor retaining the simpler accepted v12 until stronger evidence supports adding another detector.

The practical gate is unchanged, now measured relative to accepted v12: at least five points more pooled recall, a positive adjusted paired-user recall lower bound, no accuracy decline, precision loss at most two points in any period and one point pooled, at least 100 frauds/20 positive users, and at least 95% defined bootstrap draws. The full comparison requires five points more recall, a positive 95% customer recall lower bound, no accuracy decline and no more than two points precision loss.

Pooled intervals use 4,000 paired customer bootstrap draws at confidence 1-.05/28, including seven new and 21 preceding candidate comparisons. This allocation does not remove adaptive hypothesis selection, repeated-source exposure, all prior historical tuning or training variability. A zero lower bound is inconclusive under this gate. Precision intervals are descriptive: observed loss limits do not establish statistical precision noninferiority. Synthetic IBM performance is not evidence of real-bank effectiveness.

## Verification and preserved work

280 backend tests passed, including negative controls for incremental support, causal/nonrecursive episode behavior, same-time exclusion, channel/account isolation, routing, invalid scores and refusing unsafe or unchanged candidates. Strict typing, lint and formatting pass for the new implementation and runners. The [verifier](reproduction-check.json) checks training identities/weights/configuration, serialized model scores, calibration selection, all decisions, channel counts, metrics and uncertainty. An independent causal calculator checks alerts. Its incumbent replay dependency remains frozen.

Prior source modules, reports, model packages and the three protected plan/reminder files remain unchanged. The original v12 report still describes its pre-acceptance historical status; the new accepted-model record is authoritative for the user's subsequent decision. See [protocol](protocol.json), [design](design.md), [verification](verification.json), [all model records](models.json), and [reproduction instructions](reproduction.md).
