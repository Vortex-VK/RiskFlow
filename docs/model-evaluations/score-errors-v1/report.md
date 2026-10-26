# Score error against 0/100 truth

Evaluation of the installed margin-index-v1 display scores. Fraud targets are 100 and legitimate targets are 0. No model, score transformation, threshold, training data, or app behavior was changed.

For each transaction, error = score - target. RMSE = sqrt(mean(error squared)); population error SD = sqrt(mean((error - mean(error)) squared)), using ddof=0. MAE is mean absolute error. Bias is mean signed error. RMSE squared = SD squared + bias squared. All values below are score points, not percentages of classification accuracy.

RMSE measures distance from truth. SD measures spread around the average error and can hide consistent bias: scores of 0 on an all-fraud set have RMSE 100 but error SD 0. Class-balanced RMSE gives fraud and legitimate classes equal weight, preventing the more numerous class from dominating.

These metrics evaluate the current uncalibrated display transformation as well as the model. The scores are not validated fraud probabilities. A different monotone transformation can change these errors without changing model ranking. These reused synthetic populations do not establish real-world accuracy, and long/short views contain overlapping transactions.

The reviewer and prioritizer are evaluated on all eligible cards with at least ten prior completed purchases, including cards already flagged by V8. Neither output is a deployed standalone fraud classifier; operational priority applies only within additional review suggestions. The matched V8 rows provide comparisons on exactly the same eligible records.

## final-wide

| Model / subset | Rows | Fraud | RMSE | Error SD | Bias | MAE | Fraud RMSE | Legitimate RMSE | Balanced RMSE | Always-zero RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V8, all transactions | 334,777 | 263 | 0.5987 | 0.5986 | 0.0096 | 0.0148 | 11.9510 | 0.4964 | 8.4579 | 2.8029 |
| V8, card route | 289,729 | 263 | 0.5615 | 0.5615 | -0.0003 | 0.0058 | 11.9510 | 0.4311 | 8.4562 | 3.0129 |
| V8, online route | 45,048 | 0 | 0.7972 | 0.7938 | 0.0730 | 0.0730 | N/A | 0.7972 | N/A | 0.0000 |
| V8, specialist-eligible cards | 251,086 | 234 | 0.5514 | 0.5514 | -0.0001 | 0.0058 | 11.0491 | 0.4364 | 7.8190 | 3.0528 |
| Card specialist, eligible cards | 251,086 | 234 | 4.4937 | 4.4336 | 0.7323 | 0.9096 | 95.6598 | 3.4170 | 67.6848 | 3.0528 |
| Card prioritizer, eligible cards | 251,086 | 234 | 3.1903 | 3.1697 | 0.3623 | 0.5404 | 95.8858 | 1.2694 | 67.8074 | 3.0528 |

## final-short

| Model / subset | Rows | Fraud | RMSE | Error SD | Bias | MAE | Fraud RMSE | Legitimate RMSE | Balanced RMSE | Always-zero RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V8, all transactions | 334,777 | 263 | 0.7824 | 0.7823 | 0.0113 | 0.0228 | 18.4056 | 0.5885 | 13.0214 | 2.8029 |
| V8, card route | 289,729 | 263 | 0.7314 | 0.7314 | -0.0025 | 0.0108 | 18.4056 | 0.4772 | 13.0191 | 3.0129 |
| V8, online route | 45,048 | 0 | 1.0529 | 1.0481 | 0.1004 | 0.1004 | N/A | 1.0529 | N/A | 0.0000 |
| V8, specialist-eligible cards | 101,876 | 86 | 0.4640 | 0.4639 | -0.0038 | 0.0063 | 14.3195 | 0.2054 | 10.1265 | 2.9054 |
| Card specialist, eligible cards | 101,876 | 86 | 5.3303 | 5.2087 | 1.1323 | 1.2972 | 97.7671 | 4.5123 | 69.2054 | 2.9054 |
| Card prioritizer, eligible cards | 101,876 | 86 | 3.1879 | 3.1416 | 0.5410 | 0.7053 | 97.4093 | 1.4678 | 68.8866 | 2.9054 |

## diagnostic-wide

| Model / subset | Rows | Fraud | RMSE | Error SD | Bias | MAE | Fraud RMSE | Legitimate RMSE | Balanced RMSE | Always-zero RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V8, all transactions | 160,321 | 132 | 0.7230 | 0.7230 | 0.0052 | 0.0189 | 20.4202 | 0.4238 | 14.4424 | 2.8694 |
| V8, card route | 140,623 | 132 | 0.7282 | 0.7282 | -0.0053 | 0.0104 | 20.4202 | 0.3728 | 14.4417 | 3.0638 |
| V8, online route | 19,698 | 0 | 0.6851 | 0.6805 | 0.0795 | 0.0795 | N/A | 0.6851 | N/A | 0.0000 |
| V8, specialist-eligible cards | 118,649 | 78 | 0.7067 | 0.7067 | -0.0038 | 0.0097 | 22.6042 | 0.4045 | 15.9861 | 2.5640 |
| Card specialist, eligible cards | 118,649 | 78 | 3.9365 | 3.8792 | 0.6691 | 0.7983 | 98.2809 | 3.0252 | 69.5280 | 2.5640 |
| Card prioritizer, eligible cards | 118,649 | 78 | 2.7986 | 2.7695 | 0.4024 | 0.5303 | 97.4218 | 1.2624 | 68.8934 | 2.5640 |

## diagnostic-short

| Model / subset | Rows | Fraud | RMSE | Error SD | Bias | MAE | Fraud RMSE | Legitimate RMSE | Balanced RMSE | Always-zero RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V8, all transactions | 160,321 | 132 | 0.7923 | 0.7923 | 0.0084 | 0.0237 | 20.2114 | 0.5400 | 14.2967 | 2.8694 |
| V8, card route | 140,623 | 132 | 0.7591 | 0.7591 | -0.0054 | 0.0120 | 20.2114 | 0.4393 | 14.2950 | 3.0638 |
| V8, online route | 19,698 | 0 | 0.9977 | 0.9920 | 0.1071 | 0.1071 | N/A | 0.9977 | N/A | 0.0000 |
| V8, specialist-eligible cards | 48,116 | 36 | 0.4964 | 0.4964 | -0.0041 | 0.0090 | 16.2529 | 0.2210 | 11.4936 | 2.7353 |
| Card specialist, eligible cards | 48,116 | 36 | 5.1139 | 4.9924 | 1.1079 | 1.2549 | 98.2864 | 4.3518 | 69.5671 | 2.7353 |
| Card prioritizer, eligible cards | 48,116 | 36 | 3.1093 | 3.0569 | 0.5685 | 0.7154 | 98.1866 | 1.5674 | 69.4372 | 2.7353 |

## authored-scenarios

| Model / subset | Rows | Fraud | RMSE | Error SD | Bias | MAE | Fraud RMSE | Legitimate RMSE | Balanced RMSE | Always-zero RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V8, all transactions | 10,000 | 180 | 20.9092 | 20.4486 | 4.3645 | 6.6344 | 72.3969 | 18.6851 | 52.8698 | 13.4164 |
| V8, card route | 6,357 | 61 | 9.7958 | 9.7487 | -0.9596 | 0.9596 | 99.9999 | 0.0000 | 70.7106 | 9.7958 |
| V8, online route | 3,643 | 119 | 32.1348 | 29.0894 | 13.6548 | 16.5369 | 52.9337 | 31.1913 | 43.4447 | 18.0736 |
| V8, specialist-eligible cards | 5,484 | 61 | 10.5467 | 10.4879 | -1.1123 | 1.1123 | 99.9999 | 0.0000 | 70.7106 | 10.5467 |
| Card specialist, eligible cards | 5,484 | 61 | 9.4448 | 9.4182 | 0.7077 | 2.3212 | 77.3857 | 4.7797 | 54.8242 | 10.5467 |
| Card prioritizer, eligible cards | 5,484 | 61 | 9.1653 | 9.1579 | -0.3695 | 1.4916 | 86.0449 | 1.2916 | 60.8498 | 10.5467 |

## Interpretation

On the primary longer-history IBM population, V8 has RMSE 0.5987, error SD 0.5986, fraud-only RMSE 11.9510, and legitimate-only RMSE 0.4964. Its short-history fraud RMSE rises to 18.4056. The online native subsets have no fraud and cannot measure fraud-score error.

On eligible primary IBM cards, specialist fraud RMSE is 95.6598 and prioritizer fraud RMSE is 95.8858. Their small overall errors are dominated by legitimate records, not evidence that they reliably score fraud near 100. Their class-balanced RMSE values are 67.6848 and 67.8074; V8 scores on these same eligible records have balanced RMSE 7.8190.

On the separate authored scenarios, full V8 RMSE rises to 20.9092 (fraud 72.3969; legitimate 18.6851). Its card-route fraud scores are almost zero: fraud RMSE 99.9999. The online route produces much of the legitimate-score error. Specialist fraud RMSE is 77.3857 and prioritizer fraud RMSE is 86.0449. A lower overall prioritizer error here does not mean better fraud scoring: its fraud-only error is higher than the proposal specialist.

Always predicting zero gives RMSE 2.8029 on the primary IBM population and 13.4164 on the authored scenarios while missing every fraud. This demonstrates why low aggregate error alone is inadequate. Do not pool these different populations into a single reliability number.

## Reproduction and checks

Run `scripts/evaluate_score_errors.py` with the backend virtual environment and `PYTHONPATH=backend`. It refuses to overwrite existing results. [Full numeric results and source hashes](evaluation.json).

Every V8 reference decision was verified against the frozen prediction caches across 990,196 native history-view observations and 10,000 authored records. Ground truth was aligned by ID/row number and excluded from inference. The evaluator hash is verified. Known-answer arithmetic checks cover perfect scores, signed bias, class breakdown, and the RMSE/SD distinction. Every reported overall MSE was independently reconstructed from the two class-specific MSEs. Ruff checks passed. No changes to the app or model packages were required.
