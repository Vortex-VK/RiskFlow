# Purchase repair: fewer false alerts, unchanged observed detections

The approved narrow repair is enabled for new saved-dataset assessments. It removes an amount alert when repeated, prior completed purchases at the same merchant and category already cover that amount. Other risk signals remain active. It improves false-alert workload in development and fresh reserved accounts, but does not solve low fraud recall.

## Same-population comparisons

| Population | Previous legitimate alerts | New legitimate alerts | Reduction | Fraud detected, previous / new |
| --- | ---: | ---: | ---: | ---: |
| Development, users 168-295 | 2,244 | 1,877 | 367 / 16.35% | 15 / 15 of 83 scored labels |
| Reserved, users 296-423 | 1,870 | 1,681 | 189 / 10.11% | 4 / 4 of 32 scored labels |

The reserved evaluation contains 31,849 scored events, including 31,817 legitimate labels. False-positive rate fell from 5.88% to 5.28%; alert workload fell from 58.84 to 52.91 per 1,000 scored events. Precision remains very low, moving from 0.213% to 0.237%. Recall is unchanged at 12.5%, with 28 scored fraud labels missed. One additional fraud-labelled adjustment was unscored, so end-to-end capture is 4/33 = 12.12%. Neither version produced high-priority alerts in this reserved period.

These are different accounts from Phase 4's earlier 22/74 result. Compare previous and new versions within this table, not across populations. The repair only removes amount points; it cannot add detection signals. On future data it could remove an alert on fraudulent spending resembling prior spending. Unchanged detections here do not prove that impossible.

## Selection and verification

The initial 25% reduction target was not met. Three predeclared broad amount candidates reduced workload while losing development detections; a follow-up new-merchant burst hypothesis also failed. Those alternatives were not deployed. The narrower merchant-range candidate reduced development false alerts by 16.35% without losing detections. The user explicitly approved validating and shipping that smaller improvement if it held on fresh accounts.

The [selected protocol](selected-protocol.json) was frozen before reserved outcomes were read. Rule weights, thresholds, mappings, dates, warm-up and eligibility stayed fixed. There was no tuning against reserved labels. [Design history](design.md) preserves the rejected hypotheses and changed acceptance decision instead of presenting the original gate as passed.

Across both cohorts, January-June selection contains 103,291 records from 180 active users; 76 preselected users have no records and were not replaced. All 97,250 eligible attempts, including warm-up, matched the independent score and merchant-evidence calculator. Remaining records stay explicitly unscored. March-June source totals are 35,957 development and 33,929 reserved.

Outcomes remained separate from scoring. Manifests preserve hashes and reference the same extracted files throughout. [Development results](results/development.json), [reserved results](results/reserved.json), source/prediction/code manifests and an activation record are under `results/`. The activation record identifies the only backend change after outcome validation: making the already evaluated explicit `profiles-v2` configuration the default. A regression test verifies explicit/default profile, assessment and analysis-hash equality.

Implementation verification passed 204 backend tests, 183 frontend tests and 70 browser scenarios. These include evidence gates, independent calculation checks, old saved-result compatibility, new evidence display, replay and refresh. Backend lint, formatting and strict type checks passed, as did frontend lint, type checks and production build. The OpenAPI contract matches the application and its generated frontend types. These checks establish implementation consistency, separately from the limited detection effectiveness above.

## Limits and uncertainty

Reserved fraud labels occur in only three instrument accounts; both versions detect fraud in two. Both also alert on 197 of 214 accounts whose observed activity is entirely labelled legitimate. Maximum alerts per account declined from 52 to 43; median stayed at five. Account-level burden remains poor.

Both versions detect four of 14 descriptive incident proxies. Detected-only median event-time delay remains zero and maximum 900 seconds. These are synthetic proxies, not confirmed cases or operational latency.

The new version's user-cluster bootstrap 95% interval is 4.25%-6.40% for false-positive rate and 0%-0.68% for precision. Recall is defined in only 868/1,000 resamples, with a conditional interval of 8.33%-15%. Sparse, concentrated fraud makes estimates weak. Zero observed detection loss does not establish statistically equivalent recall or real banking effectiveness.

## Application behavior

New retained assessments use `assessment-v2.4`, `engine-v3`, `profiles-v2`. Merchant/category, sample count, dates, observed maximum and evidence hashes are inspectable. Above the range or without enough history, the original amount test applies. No source merchant ID means no range adjustment. Bills and configured fallback baselines retain their behavior.

Old saved assessments keep their original scores. Reassess a dataset to create a separate new-version result; replaying an old result does not recalculate it. Temporary sandbox simulations retain V1 behavior. Graphs, import workflows, playback controls, startup state and Phase 5 scope are unchanged.

See [the calculation and compatibility guide](../../merchant-amount-range.md) for exact gates and reproduction. Users 296-423 are now consumed test data. The missed-fraud problem remains an explicit next research task, not a completed claim.
