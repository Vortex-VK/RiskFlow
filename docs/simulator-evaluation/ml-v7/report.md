# V7 stopped: numerical instability invalidated its EBM comparison

The first rolling period exposed a training failure. The EBM ensemble produced finite raw scores around **1e45**, and its chronological hard-negative miner produced scores around **1e26**. Interaction terms diverged and ranking collapsed. The old finite-only score check did not reject these values. Comparing a candidate against the resulting near-all-alert EBM policy would not support a valid upgrade claim.

The experiment stopped before training the second period. No candidate was activated. All completed models, predictions, calibration cutoffs and the failed mining artifact remain under `training_data/ml-v7/2016Q4-pilot`. Later full-refit and routing steps planned for v7 were not executed; unused launchers were removed. V8 replaces this comparison with explicit stability controls and health checks. See [the v8 design](../ml-v8/design.md).

The unweighted CatBoost results are unaffected by the failed miner. They remain exploratory results on 50,944 eligible 2016Q4 purchases with 82 frauds:

| Method | Precision | Recall | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: |
| Soft-history CatBoost | 100.00% | 51.22% | 42 | 0 |
| + Sequence and merchant context | 100.00% | 62.20% | 51 | 0 |
| + Merchant geography | 96.36% | 64.63% | 53 | 2 |
| + Delayed merchant feedback | 94.74% | 65.85% | 54 | 3 |

Zero false alerts in this small synthetic evaluation is not proof of perfect precision on future data. No first-period result establishes performance on the later chip-dominated regime. The weighted CatBoost result is preserved in the raw report but is not evidence of valid hard-negative mining because its miner failed.

The independent raw CSV audit exactly matched all 36 cached role/half-year/channel groups. January–June 2018 fitting includes 74,321 online purchases and zero online frauds. The first half of 2017 has no fraud labels across fit and validation users. These are source-label properties, not extraction discrepancies. See [coverage](coverage.md), [source audit](source-audit-check.json), and [failure evidence](numerical-failure.json).

Checks of v4 pilot score magnitudes and v5/v6 model intercepts and terms did not show this explosion. Their earlier results remain intact. The new failure invalidates this v7 EBM comparison; it does not justify rewriting previous metrics or attributing all prior underperformance to the same cause.
