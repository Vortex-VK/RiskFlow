# Phase 4: measured behavior, weak fraud discrimination

The current engine is reproducible and agrees with an independent calculator on this benchmark. Its fraud discrimination remains poor: on reserved accounts it detected 22 of 74 scored synthetic fraud-labelled transactions while flagging 2,412 legitimate transactions. This supports a transparent anomaly-exploration portfolio demonstration, not a claim of trustworthy operational fraud detection.

No engine rules, weights, thresholds, application behavior or graph logic were changed. No model was trained and no additional dataset was required. The source remains the user's downloaded IBM synthetic card transaction file.

## Population and protocol

The [protocol](protocol.json) was written before inspecting the selected outcomes. It excluded the eight users consumed by Phase 3, selected all January-June 2018 activity for users 8-167, and preserved January-February as warm-up. Users 8-39 were diagnostic; users 40-167 were reserved. No fraud labels or alert scores affected selection. Settings stayed fixed through both cohorts.

The full 24,386,900-row source was scanned. Selection produced 65,085 records across 113 active users: 23 diagnostic and 90 reserved. Another 47 preselected users had no records in the period and were recorded as empty without replacement. This is a fixed convenience sample, not a random or representative sample of bank customers.

Every one of the 62,054 eligible attempts across warm-up and evaluation matched the independent eligibility, amount-profile, category, velocity and final-score calculator. The remaining 3,031 source records were not scored. Evaluation metrics below use March-June only; warm-up predictions do not enter them.

## Reserved-account results

There were 35,418 source events in the evaluation period: 33,769 scored and 1,649 unscored. The scored population contained 74 synthetic fraud labels and 33,695 legitimate labels. Two further fraud-labelled events were unscored adjustments; including those, end-to-end labelled-fraud capture was 22/76 = 28.95%.

| Frozen method | Assessed | Fraud detected | Legitimate alerts | Precision | Recall on assessed fraud |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current profiled engine | 33,769 | 22 / 74 | 2,412 | 0.90% | 29.73% |
| Static V1 | 33,769 | 0 / 74 | 0 | Undefined | 0% |
| Three attempts / five minutes reference | 33,769 | 0 / 74 | 24 | 0% | 0% |
| Six times historical median reference | 33,712 | 16 / 74 | 1,998 | 0.79% | 21.62% |

The current engine produced 2,434 alerts: approximately 72 alerts per 1,000 assessed transactions, with a 7.16% false-positive rate among legitimate transactions. About 99.1% of its alerts were legitimate under the generator labels. No event reached the high-priority threshold of 70, so simulated false blocks were zero; that does not demonstrate a safe authorization policy.

The amount-only reference lacks sufficient history for 57 otherwise assessed events. They remain explicitly unscored for that method. Static V1 only has velocity available in these inputs, and its velocity points alone cannot cross the score-40 review threshold. Its zero alerts are therefore not evidence of superior detection.

Conditional 95% user-cluster bootstrap intervals for the profiled engine were:

- Precision: 0.25%-1.71%.
- Recall: 18.18%-43.90%; defined in 999/1,000 replicates.
- False-positive rate: 5.63%-8.93%.
- Alert workload: 56.70-89.76 per 1,000 assessed transactions.

These intervals describe resampling this synthetic convenience cohort. They are not population guarantees. Fraud is concentrated in nine instrument accounts; outcome dependence and sparse fraud limit the strength of generalization.

## What the errors show

All 52 missed scored fraud-labelled events had available amount/category profiles. Thirty-seven scored zero, 12 scored ten from category novelty, and three scored thirty from amount deviation. The two unscored labelled events were outside purchase lifecycle accounting. Missing historical baselines do not explain these scored misses.

All 2,412 legitimate alerts included unusual-amount points. Of these, 1,446 triggered amount alone, 964 amount plus category novelty, and two amount plus velocity. The diagnostic cohort independently shows the same workload problem: 714 legitimate alerts among 8,069 scored events, an 8.85% false-positive rate. It had no fraud labels, so diagnostic recall is undefined and it cannot support fraud-recall tuning by itself.

This suggests that a single account-wide purchase median and first-seen category signal are too coarse to distinguish ordinary spending variation from the generator's fraud behavior. It is a hypothesis to test on development data, not proof that a particular replacement rule will work. Device familiarity, customer location and shared-device signals were unavailable throughout because those facts are absent from this source.

Channel differences are also material:

| Channel | Assessed | Labelled fraud | Detected | Legitimate alerts |
| --- | ---: | ---: | ---: | ---: |
| Chip | 23,135 | 57 | 13 | 1,498 |
| Swipe | 5,736 | 17 | 9 | 565 |
| Online | 4,898 | 0 | 0 | 349 |

Online recall is undefined. These differences do not justify adding channel penalties from this small, now-inspected reserved set.

## Account and incident burden

The profiled engine alerted on fraud-labelled events in all nine fraud-bearing instrument accounts. However, it also alerted on 213 of 233 accounts whose entire evaluation activity was labelled legitimate. Account-level detection alone would therefore be a misleading success claim. Across all 242 accounts, median alert count was five and the maximum was 93.

Using the predeclared 24-hour same-instrument gap rule, the 76 source fraud labels form 39 descriptive incident proxies. The engine detected 15 and missed 24. Among detected proxies, median event-time delay was zero and maximum delay was 76,140 seconds (21 hours, 9 minutes). This excludes missed proxies from the delay statistic and does not measure real-time latency. These are generator-derived proxies, not independently confirmed incidents.

## Delivered validation infrastructure

- Separate outcome records with provenance, synthetic versus confirmed states, confirmation times, maturity checks, and pending/disputed/absent handling.
- Frozen account/time selection, separated scoring and outcome joins, source/configuration/code/prediction hashes, overwrite guards and exact population accounting.
- Independent arithmetic checks for every eligible benchmark event and hand-calculated metric tests covering both positive and negative cases.
- Conditional and end-to-end detection denominators, false-alert workload, simulated false blocks, account burden, incident proxies, uncertainty, and activity/channel/status/history/coverage segments.
- Local per-event predictions for audit and tracked aggregate reports; raw Kaggle rows and outcome sidecars remain ignored.

See [the validation guide](../../engine-validation.md) for exact semantics, reproducible commands, file responsibilities, source assumptions and limitations. Machine-readable results are [diagnostic](results/diagnostic.json) and [reserved](results/reserved.json); their manifests contain all input and implementation hashes.

[Verification](verification.md): 191 backend tests, lint/format/type checks, independent agreement on 62,054 attempts, and byte-identical predictions/manifests from a second complete run. Application and frontend code were unchanged.

## Acceptance and next step

The bounded portfolio validation is complete. The original operational-effectiveness gate remains unmet: this synthetic source does not provide representative real outcomes, confirmation latency, actual device/location evidence or account-to-account flows. No operational acceptance thresholds were invented, no deployment was performed, and Phase 5 remains deferred.

The next useful work is improving the existing purchase signals and alert workload, not adding transfer/network scope to conceal the current weaknesses. Use diagnostic data for legitimate-alert analysis, deliberately constructed positive/negative fixtures for mechanisms, and a separately predefined development population with fraud outcomes for candidate comparisons. Reserve fresh accounts or an independently selected dataset before final testing. The reserved users in this report have now been consumed and must not become a tuned-on set still described as unseen.
