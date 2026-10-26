# Authored adaptation: target reached on heldout customers, global replacement rejected

The mixed-source candidate exceeds the user's 50–60% authored recall / at most 100 false alerts per 10,000 transactions target on the customer-heldout slice. It regresses on IBM precision and older online fraud. **It is offline; V8, card-pattern-v5 and probability-v1 remain installed.**

The app now highlights probability estimates of 90% or higher in the score explorer and transaction score details. A 90% preview button compares counts without modifying saved decisions. Historical evidence indices do not receive probability highlights. The UI calls these high estimated risk, not confirmed fraud or measured accuracy.

## Training and separation

Seven classifiers were tested across v1/v2. The selected `context_preserve` is a 350-tree, depth-six CatBoost model trained for log loss. It combines frozen V8/card-specialist margins with observable transaction and causal history features. A positive-slope logistic mapping fitted on selection customers produces probability estimates. IBM receives four times the authored source weight during classifier fitting. There is no positive-class balancing.

This is a new context model, not a rescaling of V8 alone. Additive-residual alternatives were tested but not selected. Base models remain untouched. Identity, scenario names, source/domain flags, labels and outcome feedback are excluded from predictors.

| Authored role | Customers | Rows | Frauds |
| --- | ---: | ---: | ---: |
| Classifier fitting | 61 | 5,998 | 112 |
| Probability fitting and model/policy selection | 20 | 2,067 | 38 |
| Reserved evaluation | 19 | 1,935 | 30 |

IBM fitting uses existing selection cohorts, including older online fraud; existing IBM calibration cohorts select the new head. Views of each transaction stay in one role and receive inverse multiplicity weights. Negative sampling occurs after histories are computed, with inverse inclusion weights. Original CSVs and labels are unchanged.

These synthetic sources were exposed in previous work. “Reserved” means excluded from this new fitting and selection, not an unseen generator or independent bank data. Shared merchant history can include earlier unlabeled observations from other customer groups within the upload, but no future inputs or labels.

## Authored evaluation at the user's 90% mark

Both models below score the same **1,935 reserved transactions, containing 30 frauds**. This is not an evaluation of the full 10,000 rows after training on most of them.

| Measure at probability >=90% | Existing V8 probabilities | Candidate |
| --- | ---: | ---: |
| Frauds detected | 7 / 30 | **26 / 30** |
| Recall | 23.33% | **86.67%** |
| False alerts | 54 | **1** |
| Precision | 11.48% | **96.30%** |
| Probability RMSE, points | 24.28 | **6.07** |
| False alerts per 10,000 transactions, normalized | 279.1 | **5.2** |

The candidate makes 72 more correct decisions on this slice: 19 additional fraud detections and 53 fewer false alerts. Normalized by sample size, that is approximately 372 additional correct decisions per 10,000 transactions. These are sample descriptions, not promises for another upload.

| Heldout fraud pattern | Frauds | V8 detected at90% | Candidate detected at90% |
| --- | ---: | ---: | ---: |
| Account takeover online | 7 | 4 | 7 |
| Card testing | 6 | 1 | 5 |
| Counterfeit swipe | 3 | 0 | 2 |
| Electronics cash-out | 5 | 0 | 4 |
| International online | 9 | 2 | 8 |

The remaining false alert is an ordinary/genuine-travel transaction. These small pattern counts do not establish stable pattern-specific accuracy.

A whole-customer bootstrap gives a 95% percentile interval of 78.6–94.4% for recall at90%, and 0–17.4 false alerts per 10,000. The paired improvement interval is approximately 244–483 additional correct decisions per 10,000. This captures resampling these 19 customers, not a different generator or fraud process.

## Frozen policy and IBM tradeoff

Before final access, selection chose **88.8311% for card and 96.2529% for online**. Neither cutoff changed after evaluation. The 90% results above are a predeclared diagnostic, not a policy selected after seeing the test.

At the frozen cutoffs, the candidate finds 23/30 authored frauds with two false alerts: 76.67% recall and 92% precision. Existing V8 reference decisions find 16/30 with 81 false alerts on the same slice. Thus both detection and false alerts also improve against the actual reference decisions.

| IBM population, reference policies | V8 TP / FP | Candidate TP / FP | V8 precision / recall | Candidate precision / recall |
| --- | ---: | ---: | ---: | ---: |
| Primary wide: 334,777 rows, 263 frauds | 260 / 8 | 257 / 20 | 97.01% / 98.86% | **92.78% / 97.72%** |
| Same transactions, short histories | 248 / 10 | 258 / 20 | 96.12% / 94.30% | **92.81% / 98.10%** |
| Diagnostic wide: 160,321 rows, 132 frauds | 124 / 2 | 127 / 9 | 98.41% / 93.94% | 93.38% / 96.21% |
| Same diagnostic transactions, short histories | 126 / 4 | 127 / 9 | 96.92% / 95.45% | 93.38% / 96.21% |

The primary wide test has 12 additional false alerts and three additional missed frauds. Precision drops 4.24 points, exceeding the predeclared two-point limit. **The promotion gate failed.** Wide/short views share transactions and must not be counted as independent tests.

At an identical **90% cutoff** on the primary wide population, V8 finds 256/263 frauds with six false alerts (97.71% precision, 97.34% recall); the candidate finds 257/263 with 19 false alerts (93.12% precision, 97.72% recall). On short histories, recall improves from 92.78% to 98.10%, but precision falls from 97.21% to 91.81%.

Native probability losses also regress: primary wide RMSE rises from 0.76 to 1.57 points; short-view RMSE rises from 0.97 to 1.15. Better authored loss does not imply globally better calibration.

## Older online diagnostic

An additional post-primary audit used the unchanged model and cutoffs on older IBM online data. Complete upload location/timing histories were reconstructed from hash-checked raw inputs before filtering online rows. V8 reference decisions were reproduced exactly. Neither diagnostic was used for fitting or tuning.

| Older online population | At90% V8 TP / FP | At90% candidate TP / FP |
| --- | ---: | ---: |
| 2018 calibration diagnostic: 22,267 rows, 10 frauds | 6 / 0 | 4 / 2 |
| 2018 extension diagnostic: 9,805 rows, 36 frauds | 20 / 0 | **10 / 0** |

At the frozen, higher online cutoff, candidate detection is only 3/10 and 4/36, versus V8 reference detection of 6/10 and 22/36. This substantial regression prevents a claim of general improvement.

## Decision and next step

Retain the candidate and reproducible predictions; keep the installed engine unchanged. A separate, explicitly experimental authored-demo mode is a defensible option, but it is not implemented or automatically selected by upload content in this change.

For a general replacement, a new study should include broader earlier online fraud support in development and new customer/generator holdouts, with older-online preservation as an explicit gate. Current final files must remain recorded diagnostics, not supposedly fresh tests after tuning. High feature importance for history span and shared-merchant activity also warrants different upload lengths and generators; the candidate may learn properties of this authored generator.

## Verification and artifacts

- Independent audit recounted 20 primary confusion matrices, verified saved-model probabilities, customer isolation, head label/identity independence, prefix parity, and older native source separation.
- Frontend: 235 unit tests, targeted Playwright/accessibility test, TypeScript, ESLint and production build passed. The additional boundary test prevents rounding below90% or historical indices from receiving a high-probability highlight. Existing bundle-size warning remains.
- V3 policy and audit scripts pass backend Ruff rules. V1/v2 scripts were frozen after formatting under the default configuration; the later backend-config check reports import ordering only. Their code hashes are preserved.
- No backend runtime, model schema, existing trained package or sample CSV was changed.

Evidence: [protocol](protocol.json), [frozen model/cutoffs](frozen.json), [evaluation](evaluation.json), [audit](audit.json), [verification](verification.json). Selection studies: [v1](../authored-adaptation-v1/report.md), [v2](../authored-adaptation-v2/report.md). Scripts: [v1 training](../../../scripts/train_authored_adaptation.py), [v2 training](../../../scripts/train_authored_residual.py), [policy/evaluation](../../../scripts/select_authored_policy.py), [audit](../../../scripts/audit_authored_adaptation.py).
