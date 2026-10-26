# Six additive recall candidates: no upgrade selected

V10 combined was recorded as the user-selected best offline model before this round. None of these six candidates passed the frozen v11 upgrade gate. Historical results and the accepted v10 artifacts remain unchanged.

| Method | Accuracy | Precision | Recall | F1 | Fraud found | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted v10 | 99.9386% | 97.08% | 64.84% | 77.75% | 166 | 5 |
| Add online CatBoost | 99.9432% | 96.67% | 67.97% | 79.82% | 174 | 6 |
| Online consensus | 99.9432% | 96.67% | 67.97% | 79.82% | 174 | 6 |
| Add online EBM | 99.9425% | 96.65% | 67.58% | 79.54% | 173 | 6 |
| Online union | 99.9425% | 96.13% | 67.97% | 79.63% | 174 | 7 |
| Both specialists plus recent follow-up | 99.9451% | 96.22% | 69.53% | 80.73% | 178 | 7 |
| Recent account follow-up | 99.9412% | 97.14% | 66.41% | 78.89% | 170 | 5 |

Common population: 154,820 purchases, 256 frauds, 42 distinct users with fraud. The historical CatBoost added eight correct detections for one extra false alert, all in the latest period. Recent-account follow-up added four detections and no false alerts. The online union added an unnecessary second false alert. Combining both specialists with recent follow-up gained only 4.69 percentage points of pooled recall, below the five-point requirement, and lost more than two precision points in the latest pilot period.

No gate was relaxed after evaluation. V11 therefore selected the baseline, and no v11 full-model comparison was run. A separately frozen [v12 follow-up](../ml-v12/report.md) tests online episode corroboration and retains all these failed results. See [protocol](protocol.json), [complete results and uncertainty](results.json), [replay](reproduction-check.json) and [verification](verification.json).

Every outcome is exploratory on already exposed synthetic IBM data. Precision loss limits concern observed estimates, not a proven future noninferiority bound. No runtime activation or new training occurred.
