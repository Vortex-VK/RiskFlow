# Robust portable model experiment

Selected shared setup: **rich-balanced**, chosen on development outcomes only. Prespecified research gates passed: **False**. No model was promoted to production. Sparkov is a new synthetic generator in this experiment, not independent real-world banking validation.

The implementation expands IBM to all users, adds causal relative merchant and category/channel context, and retains short-history/cold/missing-field augmentation. No raw identities, demographics, fraud labels or absolute monetary levels are model features. All history remains separated by source, account and unit.

**Conclusion:** the additional context produces a substantial, measured improvement on the development generators, but this is still not a reliable general-upload fraud model. Compared with the identically split, equally weighted core baseline, IBM gains 19.08 recall percentage points and Handbook gains 3.42 points at the fixed review budget. Sparkov loses 6.13 points. All three paired-user intervals exclude zero, so the negative transfer cannot be dismissed as a small seed fluctuation. The selected model remains offline; the predeclared generalization gate failed.

Your supplied 10,000-row upload also remains difficult: the selected model detects only 8 of 180 fraud cases in 181 reviews, compared with 7 for the expanded core baseline and 14 for the historical portable model. This is not evidence of useful improvement on that upload. Source-specific calibration is not applied to either the upload or Sparkov.

## Full-input results at equal review capacity

Base seed. Daily budget is ceil(1% of eligible records), separately per source. Unscored fraud remains missed. AP is measured on scored records. Threshold F1 is available only with a supported matching-source calibration.

Legacy is a historical reference: its training population, periods and augmentation also differ, so it is not a pure data-expansion ablation. Rich-balanced versus core-balanced controls those factors and isolates the additional feature set.

| Setup | Source | Detected / fraud | Reviews | Recall at 1% | Recall at 5% | AP | Threshold F1 |
|---|---|---:|---:|---:|---:|---:|---:|
| legacy | handbook | 749 / 2547 | 2893 | 29.41% | 35.92% | 24.32% | unavailable |
| legacy | ibm | 6 / 262 | 1364 | 2.29% | 11.83% | 0.24% | unavailable |
| legacy | sparkov | 206 / 1011 | 1234 | 20.38% | 51.24% | 9.55% | unavailable |
| core-balanced | handbook | 744 / 2547 | 2893 | 29.21% | 35.37% | 24.75% | 29.65% |
| core-balanced | ibm | 3 / 262 | 1364 | 1.15% | 11.83% | 0.27% | 0.54% |
| core-balanced | sparkov | 190 / 1011 | 1234 | 18.79% | 49.26% | 8.74% | unavailable |
| rich-quarter | handbook | 836 / 2547 | 2893 | 32.82% | 36.59% | 32.00% | 41.57% |
| rich-quarter | ibm | 33 / 262 | 1364 | 12.60% | 30.92% | 1.78% | 4.80% |
| rich-quarter | sparkov | 184 / 1011 | 1234 | 18.20% | 55.09% | 9.24% | unavailable |
| rich-balanced | handbook | 831 / 2547 | 2893 | 32.63% | 36.51% | 31.79% | 41.00% |
| rich-balanced | ibm | 53 / 262 | 1364 | 20.23% | 44.66% | 3.30% | 7.85% |
| rich-balanced | sparkov | 128 / 1011 | 1234 | 12.66% | 53.81% | 8.24% | unavailable |
| rich-threequarters | handbook | 813 / 2547 | 2893 | 31.92% | 36.20% | 31.38% | 40.95% |
| rich-threequarters | ibm | 52 / 262 | 1364 | 19.85% | 46.18% | 3.53% | 8.05% |
| rich-threequarters | sparkov | 108 / 1011 | 1234 | 10.68% | 53.41% | 7.16% | unavailable |
| rich-handbook | handbook | 842 / 2547 | 2893 | 33.06% | 36.55% | 32.19% | 41.54% |
| rich-handbook | ibm | 13 / 262 | 1364 | 4.96% | 13.36% | 0.39% | unavailable |
| rich-handbook | sparkov | 242 / 1011 | 1234 | 23.94% | 53.02% | 13.41% | unavailable |
| rich-ibm | handbook | 383 / 2547 | 2893 | 15.04% | 25.44% | 6.65% | unavailable |
| rich-ibm | ibm | 57 / 262 | 1364 | 21.76% | 47.71% | 4.46% | 8.71% |
| rich-ibm | sparkov | 182 / 1011 | 1234 | 18.00% | 43.42% | 8.32% | unavailable |

## Primary paired uncertainty

Selected shared setup minus expanded core-balanced. 500 paired whole-user resamples recompute ranking and daily budgets; seven-day blocks give a time sensitivity check. Reused Handbook/IBM populations remain exploratory.
Sparkov resampling uses the cc_num card account; a separate customer identity is not assumed. IBM resamples entire users, keeping their cards together.

| Source | Difference | User 95% interval | Seven-day 95% interval |
|---|---:|---:|---:|
| handbook | +3.42 pp | [+2.42, +4.31] pp | [+2.68, +4.24] pp |
| ibm | +19.08 pp | [+13.20, +25.08] pp | [+15.33, +22.96] pp |
| sparkov | -6.13 pp | [-9.50, -2.46] pp | [-9.21, -3.22] pp |

## History and missing metadata

Recall at 1%, mean [minimum, maximum] across three seeds.

Cold conditions remove all prior observation history. With only relative features, these inputs carry essentially no transaction-specific discrimination; deterministic ID tie breaks are not fraud evidence. Missing-optional-field conditions preserve purchase history while removing merchant, category and channel context. These are separate limitations.

| Setup | Source | Full | One day | Cold | Missing optional fields |
|---|---|---:|---:|---:|---:|
| core-balanced | handbook | 29.26% [29.21%, 29.33%] | 6.69% [6.64%, 6.79%] | 1.06% [1.06%, 1.06%] | 29.26% [29.21%, 29.33%] |
| core-balanced | ibm | 1.40% [1.15%, 1.91%] | 3.69% [3.44%, 3.82%] | 0.00% [0.00%, 0.00%] | 1.40% [1.15%, 1.91%] |
| core-balanced | sparkov | 18.50% [17.41%, 19.29%] | 0.43% [0.30%, 0.59%] | 1.29% [1.29%, 1.29%] | 18.50% [17.41%, 19.29%] |
| rich-quarter | handbook | 32.85% [32.78%, 32.94%] | 10.33% [10.21%, 10.40%] | 1.06% [1.06%, 1.06%] | 31.21% [31.02%, 31.37%] |
| rich-quarter | ibm | 13.87% [12.60%, 15.65%] | 7.12% [6.11%, 8.78%] | 0.00% [0.00%, 0.00%] | 1.91% [1.91%, 1.91%] |
| rich-quarter | sparkov | 15.99% [13.35%, 18.20%] | 2.08% [1.98%, 2.27%] | 1.29% [1.29%, 1.29%] | 21.66% [20.87%, 22.16%] |
| rich-balanced | handbook | 32.69% [32.63%, 32.74%] | 10.22% [9.85%, 10.44%] | 1.06% [1.06%, 1.06%] | 30.60% [30.59%, 30.62%] |
| rich-balanced | ibm | 19.72% [19.08%, 20.23%] | 9.29% [6.87%, 11.07%] | 0.00% [0.00%, 0.00%] | 1.65% [1.53%, 1.91%] |
| rich-balanced | sparkov | 12.27% [9.00%, 15.13%] | 2.57% [2.47%, 2.67%] | 1.29% [1.29%, 1.29%] | 21.40% [20.57%, 22.26%] |
| rich-threequarters | handbook | 32.00% [31.92%, 32.12%] | 9.17% [8.68%, 9.62%] | 1.06% [1.06%, 1.06%] | 29.71% [29.45%, 30.11%] |
| rich-threequarters | ibm | 20.99% [19.85%, 21.76%] | 10.31% [9.54%, 11.07%] | 0.00% [0.00%, 0.00%] | 3.05% [1.91%, 3.82%] |
| rich-threequarters | sparkov | 11.74% [10.68%, 13.65%] | 2.04% [1.68%, 2.67%] | 1.29% [1.29%, 1.29%] | 21.93% [21.36%, 22.26%] |
| rich-handbook | handbook | 33.06% [33.02%, 33.10%] | 10.17% [10.05%, 10.29%] | 1.06% [1.06%, 1.06%] | 31.93% [31.84%, 32.04%] |
| rich-handbook | ibm | 4.83% [4.58%, 4.96%] | 4.07% [3.82%, 4.20%] | 0.00% [0.00%, 0.00%] | 3.18% [2.67%, 3.44%] |
| rich-handbook | sparkov | 25.22% [21.27%, 30.46%] | 1.65% [1.58%, 1.68%] | 1.29% [1.29%, 1.29%] | 21.20% [19.39%, 23.64%] |
| rich-ibm | handbook | 15.46% [15.04%, 16.18%] | 2.51% [2.04%, 3.42%] | 1.06% [1.06%, 1.06%] | 10.25% [7.18%, 13.51%] |
| rich-ibm | ibm | 20.61% [19.47%, 21.76%] | 11.20% [11.07%, 11.45%] | 0.00% [0.00%, 0.00%] | 8.02% [7.63%, 8.40%] |
| rich-ibm | sparkov | 17.34% [15.33%, 18.69%] | 6.17% [6.03%, 6.33%] | 1.29% [1.29%, 1.29%] | 27.63% [26.41%, 28.88%] |

## Evidence and limitations

Development support:

| Source | Role | Rows | Fraud | Fraud users | Supported |
|---|---|---:|---:|---:|---|
| handbook | calibration | 184540 | 1666 | 822 | True |
| handbook | fit | 414422 | 3555 | 1431 | True |
| handbook | selection | 183781 | 1575 | 764 | True |
| ibm | calibration | 86802 | 120 | 23 | True |
| ibm | fit | 193542 | 258 | 33 | True |
| ibm | selection | 86390 | 88 | 19 | True |

Evaluation populations:

| Source | Rows | Eligible | Fraud | Fraud users |
|---|---:|---:|---:|---:|
| handbook | 287873 | 287864 | 2547 | 1246 |
| ibm | 141557 | 134705 | 262 | 37 |
| sparkov | 120805 | 120805 | 1011 | 101 |

Research gate results:

- ibm_gain_5pp: True
- ibm_positive_interval: True
- handbook_no_loss_over_2pp: True
- sparkov_recall_10pct: True
- sparkov_no_loss_over_2pp: False
- sparkov_support: True

## Calibration

Sigmoid calibration uses each permitted source's separate August calibration block at natural prevalence. It is not applied to the held-out Sparkov source. Good calibration on a synthetic source does not establish probability accuracy on uploads. Full reliability bins, Brier/log-loss baselines, subgroup results and model receipts are in `results.json`.

| Source | Selected-model Brier | Prior Brier | Log loss | Prior log loss | ECE |
|---|---:|---:|---:|---:|---:|
| handbook | 0.006523 | 0.008770 | 0.038591 | 0.050640 | 0.000175 |
| ibm | 0.001838 | 0.001860 | 0.011381 | 0.013649 | 0.000563 |

## Supplied-upload diagnostic

The supplemental protocol was frozen before the main model nomination and final outcomes were opened. It uses only the original unlabeled CSV for prediction, then validates every feature column, row number, account/card identity, minute timestamp and fraud label against the two outcome files. No extra history is invented. The fixture was already exposed in earlier V13 work, so this is a diagnostic rather than another untouched confirmation source. The selected model and baseline use identical records and review counts; probabilities remain unavailable.

| Model | Detections at daily 1% | Recall at daily 1% | Detections at daily 5% | Recall at daily 5% | AP |
|---|---:|---:|---:|---:|---:|
| Historical portable model | 14 / 180 | 7.78% | 38 / 180 | 21.11% | 9.19% |
| Expanded core baseline | 7 / 180 | 3.89% | 34 / 180 | 18.89% | 5.55% |
| Selected richer model | 8 / 180 | 4.44% | 24 / 180 | 13.33% | 3.97% |

There are 181 reviews at the 1% daily policy and 585 at 5%; daily rounding makes these greater than 1% and 5% of the total 10,000 records. The selected-minus-core user-bootstrap recall interval is [-2.06, +2.49] percentage points at 1%, and the time-block interval is [-4.61, +4.66]. There is no supported improvement. These are portable-model comparisons, not a reproduction of V13's different alert policy. Exact results are in [supplemental-results.json](supplemental-results.json).

## What to change next

1. **Make optional-context semantics explicit.** Source-specific category granularity, merchant identity granularity and channel definitions still affect relative frequencies even when raw IDs and absolute amounts are excluded. In the prespecified missing-context control, the selected model's Sparkov recall rises from 12.66% to 20.57%, while IBM drops from 20.23% to 1.53%. This suggests different utility of those fields across sources. A future model should use declared, validated context contracts and separately validated experts or fallback paths. Do not retrofit this control as the primary winner after seeing Sparkov outcomes.
2. **Develop across more independent domains.** Promote the now-consumed Sparkov cohort to development only in a new protocol, and use leave-one-source-out selection so each source acts as an unseen development domain. Keep a fourth compatible source untouched for confirmation. New months or users from the same generator test temporal or population transfer, not new-source generalization.
3. **Acquire labeled examples representative of intended uploads.** The supplied upload is the most direct evidence that the current synthetic training signals are insufficient for the intended use. Obtain adjudicated outcomes and legitimate examples covering the actual transaction types, merchant conventions, missingness and history lengths. Preserve an untouched future/customer split and use realistic outcome delays. Adding unlabelled uploads or repeatedly tuning to these 180 known positives does not provide independent evidence of accuracy.
4. **Keep probability and action scope narrow.** Known-source Brier and log-loss improvements do not validate probabilities on new sources. Small overall calibration error can hide poor discrimination and sparse high-risk bins in imbalanced data. Keep unsupported-domain outputs descriptive or explicitly experimental rankings, with no invented probability or automatic payment decision.

The tested improvement is the new causal context representation on compatible data. The remaining obstacle is demonstrated source shift and weak performance on the supplied upload. No larger-estimator search or more reuse of the same final sets is justified as a substitute for the next data and validation step.

## Implementation and verification

- Added the shared context feature implementation in `backend/app/domain/features/behavioral_context.py` and the reproducible experiment pipeline in `backend/ml/behavioral/robust/`.
- Twelve declared candidate fits plus twelve additional seed fits completed. The chosen shared model was frozen from selection results before calibration and all final outcome access. Full, one-day, cold and missing-context conditions produced 219 main prediction sets, plus three supplemental upload predictions.
- The [independent audit](numerical-audit.json) verified all 219 prediction files, eligibility coverage, source weights, predictor exclusions, calibration scope, and separate pandas computations of the primary review counts. Main evaluation also checks identical populations across all comparisons.
- Maximum recorded training-process peak memory was 1.017 GiB, below the 2.5 GiB limit. Each estimator used two threads.
- Backend tests, lint, formatting and strict typing are recorded in `validation.json`. Tests include causal ordering, equal-time isolation, account/source separation, expiry, currency-scale invariance, exact legacy-feature parity, training target guards, source weights and unsupported probability scope.
- V13 manifest SHA-256 remains `62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046`. The production inference route, frontend and previously saved assessments remain unchanged.

## Reproduction and provenance

Run `python -m ml.behavioral.robust` with `PYTHONPATH=backend` and the backend virtual environment. Actions: `freeze`, `extract-ibm`, `extract-sparkov`, `prepare --source SOURCE --condition full|short1`, then `run`. Fetch the public archive with `python -m ml.behavioral.robust.fetch` after freezing. Source/model artifacts remain under `training_data/ml-general/robust-v2`; existing completed experiments are immutable. Use a new version for another protocol.

The original protocol and header-only `preparation-correction.json` are both preserved. `prediction-freeze.json` records every saved prediction before final outcome joining. The archive is publisher version 1, CC0, with local SHA-256 `4e32829b9ba5a6b17af707c513c15204011044df0e8971e431cedca3d8c0a8a1`. Only January-March 2019 observations enter features and evaluation; the chunked CSV parser scans the larger file, and its outcome pass transiently parses other periods before filtering. Those periods are not claimed as pristine future holdouts. fraudTest.csv remains unopened.

Design references: [chronological validation and label delay](https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_5_ModelValidationAndSelection/ValidationStrategies.html), [WILDS source-shift evaluation](https://proceedings.mlr.press/v139/koh21a.html), [Sparkov dataset publisher](https://www.kaggle.com/datasets/kartik2112/fraud-detection). Seven-day label availability and IBM/naive-clock UTC conventions are declared assumptions. No real-source fraud-probability or universal accuracy claim follows.
