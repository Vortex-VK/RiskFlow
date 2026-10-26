# Phase 3 evaluation: historical profiling, not validated fraud detection

Phase 3 makes previously unavailable amount/category signals evaluable from prior history. The IBM synthetic-data evaluation does **not** support a claim of useful fraud detection from the current rules.

The selection, adapter assumptions, exact configurations and reproduction commands are documented in [Historical profiles](../../historical-profiles.md). Source/extract hashes are in [manifest.json](manifest.json). The source was scanned in full to select the declared subsets; the engine was evaluated on those subsets, not all 24.4 million rows. The downloaded data was not modified or added to tracked fixtures.

## Results

Alerts use the unchanged score threshold of 40, including scores of 70 and above. Labels come from the generator's separate outcome column. Precision is true alerts / all alerts, recall is detected labeled fraud / all scored labeled fraud, and false-positive rate is legitimate alerts / scored labeled legitimate transactions. Null means the denominator is zero, not perfect performance.

| Evaluation | Scored March–June | Labeled fraud | True alerts | Legitimate alerts | Missed fraud | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Development, V1 static inputs | 1,748 | 7 | 0 | 0 | 7 | Undefined | 0% |
| Development, 10 samples / 7 days | 1,748 | 7 | 0 | 66 | 7 | 0% | 0% |
| Development, 20 samples / 14 days | 1,748 | 7 | 0 | 61 | 7 | 0% | 0% |
| Reserved accounts, V1 static inputs | 1,440 | 0 | 0 | 0 | 0 | Undefined | Undefined |
| Reserved accounts, frozen 10 / 7 setting | 1,440 | 0 | 0 | 24 | 0 | 0% | Undefined |

The default development configuration supplies learned amount baselines for 1,746 of 1,748 evaluated purchases; the stricter candidate supplies 1,717. Both miss every labeled fraudulent purchase in this small development sample. The stricter setting trades five fewer legitimate alerts for 29 fewer available profiles. There is no clear demonstrated detection winner. The initial 10/7 hypothesis remains the default; no rule weights, thresholds, account exclusions or scenario-specific exceptions were tuned against the reserved labels.

The reserved-account setting has a 1.67% legitimate alert rate (24/1,440), with amount baselines available for every evaluated purchase. **There are no labeled fraudulent transactions in that evaluated subset, so held-out recall is unmeasurable.** Do not report accuracy, a favorable fraud-detection rate, or general bank performance from this result. The unchanged V1 path has only velocity available here; zero V1 alerts are not evidence that its decisions are better informed.

Across the full six-month extracts, 96 development rows and 25 holdout rows are outside the scored purchase population. They remain source records. Labels do not cause exclusions. The scripts report metrics only for scored March–June activity, rather than silently including excluded records as true negatives.

Machine-readable outputs: [development.json](development.json), [holdout.json](holdout.json).

## What this establishes

The independent arithmetic and chronology fixtures verify baselines, amount thresholds, explicit cold starts, purchase/bill separation, exact category retention, lifecycle eligibility, device familiarity/trust separation, correction snapshots, deterministic retained replay and label-independent adaptation. The realistic extract shows that profiling activates missing inputs for unfamiliar accounts without training a model on example account IDs.

It also shows that these particular six heuristics and score weights are insufficient for this benchmark. Typical amount multiples and first-seen categories are weak proxies for fraud. Device/customer-location signals cannot be evaluated from this source. The MCC vocabulary does not identify recurring bills or actual device sharing, so those implementations are checked with controlled fixtures rather than claimed validated by Kaggle outcomes.

## Next steps

1. Inspect missed-fraud and legitimate-alert explanations in development data; decide which detectable behavior the project should demonstrate. Do not equate all generator fraud labels with behavior observable in our supported fields.
2. For a broader effectiveness study, predefine a larger account/time selection and scoring protocol, retain chronology and account separation, and include enough labeled incidents to estimate recall. Freeze policy before inspecting its reserved outcomes. The current reserved set is already consumed and must not become a tuning set described as unseen.
3. Evaluate richer amount/context features and thresholds on development data only if that study is desired. Retain the current transparent anomaly-exploration framing for the portfolio until evidence supports stronger claims.

No trained regression model, production authorization path, automatic account blocking, or ML dependency was introduced.
