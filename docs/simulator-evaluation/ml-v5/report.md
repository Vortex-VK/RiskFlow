# Precision-focused sequence experiment

The full-data sequence ensemble did not pass its development gate. Its precision gain was 1.60 percentage points, below the frozen two-point requirement. No v5 confirmation scores were generated and no reserved outcomes were opened by this experiment. The predeclared hard-negative fallback is recorded separately under [v6](../ml-v6/design.md).

Both methods were fitted on all 565,519 eligible January–June 2018 fitting purchases, including 749 frauds across 77 users. Each is the mean raw score of two unchanged EBM configurations, seeds 20261024 and 20261025. Development contains 103,876 separate-user July–December purchases, including 174 frauds across 21 users. Each method independently selected the cutoff maximizing precision subject to at least 40% pooled recall. Equal-score groups are indivisible; no probability interpretation is claimed.

| Development policy | Precision | Recall | F1 | Alerts | True frauds | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Refit incumbent ensemble | 18.92% | 40.23% | 25.74% | 370 | 70 | 300 |
| Sequence ensemble | 20.52% | 40.80% | 27.31% | 346 | 71 | 275 |

The raw-score cutoffs are -2.693064936590201 and -2.60788228289617 respectively. Both individually thresholded seeds improved precision, and the quarter-level recall guards passed, but the ensemble gain did not meet the minimum. It was not rounded upward or tested on confirmation anyway. The earlier sampled-pilot precision figures do not describe these full-data refits.

The protocol targets fixed score decisions rather than a top-1% review quota. A stricter cutoff alone changes the precision/recall tradeoff; a model improvement requires a fair comparison against an incumbent whose cutoff is also optimized. The historical held-out-user and synthetic-data limitations remain. See the [design](design.md), [protocol](protocol.json), [development record](development.json) and [reproduction instructions](reproduction.md).

Validation matched all 39 baseline/sequence inputs exactly across all 103,876 development purchases. Serialization reproduces every model's development scores exactly; native contributions reconstruct raw model scores. Replaying the ensemble reproduces all scores, thresholds and selection checks exactly. Seven new tests cover threshold ties and recall constraints, independent confusion counts, literal row-resampling parity for cluster intervals, false-positive/recall tradeoffs, feature alignment and frozen-outcome access. Together with the conditional fallback, the full backend suite passes 246 tests and strict typing covers 85 sources. The v5 training process recorded a 1.16 GiB peak working set; individual fits took 16.5–21.7 seconds. Feature loading and checks add wall time.

The application, v1–v4 artifacts, `plan.md` and `todo.md` remain unchanged. A second complete training rebuild was not run. This is a validated negative screening outcome, not a production model release or a confirmed precision upgrade.
