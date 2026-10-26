# Recall-focused card specialist experiment: not promoted

The user requested more emphasis on finding fraud while allowing false positives to remain risky transactions for review. Four broader models and an adjusted-cutoff baseline were tested. **The selected candidate failed separate calibration, so the installed specialist remains card-pattern-v5 and Upload-v8 remains frozen.** No new fraud-detection improvement is claimed.

The broader candidate looked promising on selection data. At that selected cutoff, later calibration produced no additional fraud detections and false suggestions on 113 distinct legitimate transactions. Retuning the selected model's cutoff on calibration did not support an active policy at missed-fraud weights of five, ten or twenty, within the predeclared workload limit.

## Objective and safeguards

The working objective was incremental `10 × additional fraud detections − additional legitimate reviews`, treating one missed fraud as ten unnecessary reviews. This is an explicit development preference, not an estimated financial cost. Sensitivities at weights five and twenty were also checked.

Additional false reviews were capped at 0.1% of legitimate transactions separately in every development period and history view. Existing v8 alerts and v1/v5 review leads were excluded from candidate credit. Existing leads and their priorities would have been preserved, and any new output would have remained an experimental review suggestion, not a confirmed fraud label or a change to v8 metrics.

Cutoffs considered whole score ties and included abstention. The best model was selected on the selection cohort; only that model was calibrated on the later, separate cohort. No model was selected or tuned against the authored scenario outcomes in this experiment.

## Broader training data

The new older fitting cohort contains **1,993,334 card transactions and 1,367 swipe frauds**, from 2004–2009, customer buckets 0/1. Fraud cases span **242 customers and 79 MCC categories**, including **20 electronics-store swipe frauds**. The largest state/country groups include Algeria, California, Florida, Ohio and Turkey. These cases improve geographic and merchant-category coverage, but do not provide direct chip-electronics fraud examples.

Combined with the earlier 2015–June 2016 and newer 2018H2–2019H1 fitting cohorts, the training pool contains **3,411,474 distinct card transactions and 2,518 distinct frauds**. Some newer records have both long and short history views. The deterministic fitting sample contains 421,542 view observations, retaining all frauds and selected hard negatives, with inclusion weights for sampled legitimate transactions.

Full histories were reconstructed before negative sampling. The new selection cohort is 2010–2012 bucket 2: 796,402 card transactions and 128 frauds. The new calibration cohort is 2013–2014 bucket 3: 531,634 card transactions and 113 frauds. Both have wide and short history views, combined with the previous historical and recent development cohorts. Fit users are absent from these development populations, and fitting/selection/calibration source rows are disjoint.

2013–2014 bucket 4 was reserved for evaluation. Its raw extraction was saved, but its features and predictions were **not built**, because calibration failed first. Aggregate year/bucket fraud counts had previously been audited, so it would not have been an entirely unexposed source. No reserved customer or scenario outcome was used to rescue the candidate.

This remains mixed-era research on the same public synthetic IBM source. History views repeat source transactions and are not independent evidence. The frozen v8 engine includes training from later periods; these older cohorts are application-transfer checks, not a chronological deployment backtest or external validation.

## Candidate comparison and correction

The candidates were:

- Frozen v1 weights with a separately selected recall cutoff.
- Relative behavior, depth six, fraud fitting weight five.
- Relative behavior plus payment channel/hour familiarity, depth six, weight five.
- Relative behavior without channel identity, depth eight, weight ten, to test behavioral transfer from swipe to chip.
- Relative behavior, channel and geographic familiarity, depth six, weight five.

New models use 400 CatBoost trees, learning rate 0.06, L2 15, seed 20261025 and two threads. They exclude raw identities, absolute geographic values, raw MCC, absolute amount and fraud feedback. The selected familiarity model has 44 features.

The initial v6 comparison excluded existing reviewer leads but still credited frauds already detected by v8. This was corrected **before opening any reserved or scenario evaluation**. V7 reuses all five frozen weight files and reselects/recalibrates them after excluding the union of v8 alerts and existing reviewer leads. V6's original protocol and outputs remain preserved as a superseded study, not a successful promotion.

| Candidate | Selection incremental utility at 10:1 | Additional fraud flags across views | Additional legitimate flags across views |
| --- | ---: | ---: | ---: |
| V1 cutoff baseline | 5 | 1 | 5 |
| Relative behavior | 9 | 3 | 21 |
| Channel-aware | 30 | 4 | 10 |
| Deeper relative behavior | 4 | 2 | 16 |
| Geographic familiarity | **205** | **35** | **145** |

The selected cutoff was `0.012804237229225395`. Its 35 selection fraud flags represent 24 distinct fraud transactions; 145 legitimate flags represent 129 distinct transactions, because views overlap.

## Calibration failure

Applying that selected cutoff unchanged to the separate calibration cohort gives:

| Calibration period / view | Additional fraud | Additional legitimate reviews |
| --- | ---: | ---: |
| 2013–2014, wide | 0 | 68 |
| Same older rows, short | 0 | 27 |
| 2016Q4, wide | 0 | 11 |
| Same historical rows, short | 0 | 10 |
| 2019Q3, wide | 0 | 9 |
| Same recent rows, short | 0 | 7 |

That is **zero additional fraud flags and 132 legitimate review flags across views**, involving 113 distinct legitimate transactions. This is a failure to transfer across periods/customers, despite the larger training pool.

When the selected weights were calibrated under the same objective and workload constraints, abstention was optimal. The frozen threshold is therefore `null`. The planned five-to-one and twenty-to-one sensitivities also supported no active cutoff within the budget. These findings do not imply that every conceivable operating policy is impossible; they reject the tested policy family and model-selection result.

[Frozen result](frozen.json), [candidate comparison](experiments.json), [selection-cutoff transfer](selection-cutoff-transfer.json), [cost sensitivity](cost-sensitivity.json), [decision](decision.json), [protocol](protocol.json), [older training audit](../card-pattern-v6/older-fit-audit.json).

## App status and next direction

No runtime package was promoted. Card-pattern-v5 still retains 13 authored-scenario fraud suggestions and seven legitimate suggestions, with six frauds prioritized. Its native IBM false suggestions remain documented in the [installed reviewer report](../card-pattern-v5/report.md). V8 weights, thresholds, model decisions, sample files and reported model metrics are unchanged.

More IBM volume alone did not produce reliable additional detection. A useful next study would define the desired card-pattern mechanisms and matched legitimate controls independently, including hard cases such as genuine travel, large purchases, unfamiliar merchants and repeated payments. If authored simulation is used for that study, its results must be presented as simulated-pattern coverage, not bank fraud accuracy. Device/card-authentication signals would require additional real inputs; they cannot be inferred from this CSV schema.

## Verification and reproduction

The six new policy tests cover the missed-fraud preference, per-view review budgets, whole ties, excluding already-flagged frauds, channel/history eligibility, and preserving online timing when reconstructing card context. Rebuilt candidate features match the live builder exactly on a checked 838-card window; reconstructed historical context and v8 card decisions match on a separate 901-card window. Labels are joined by source transaction identity.

Research stages use the repository Python with `PYTHONPATH=backend`:

```text
-m ml.card_recall_research prepare
-m ml.card_recall_research build
-m ml.card_recall_research train
-m ml.card_recall_residual
```

The first experiment's snapshots record pre-fit protocol formatting, the addition of the baseline, and a memory optimization projecting only required columns. None changed fitting observations, feature values or weights. Feature jobs used separate output files; an attempted duplicate build correctly refused to overwrite an in-progress cache. All completed cache hashes were checked before training.

`ml.card_recall_evaluate --residual` explicitly refuses to open reserved data when the calibrated cutoff is unsupported. Draft packaging/runtime code was removed, so there is no unfinished replacement connected to the app. Final test and artifact checks are recorded in [verification](verification.json).
