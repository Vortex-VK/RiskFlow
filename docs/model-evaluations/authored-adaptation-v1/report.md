# Authored adaptation v1: selection experiment, not installed

The user set a target of 50–60% authored fraud recall and at most 100 false alerts per 10,000 transactions, with a small IBM tradeoff. This experiment trains on authored examples for the first time. It does not change V8, the card reviewer, or their probability package.

## Data separation

The existing 10,000-row authored fixture contains 100 customers and 180 labeled frauds. A fixed, scenario-stratified customer split assigns 61 customers to fitting (112 frauds), 20 to selection/calibration (2,067 rows, 38 frauds), and 19 to final evaluation (1,935 rows, 30 frauds). Every customer's transactions stay together. Scenario names and outcomes are excluded from predictors. Original CSV inputs and labels are unchanged.

IBM fitting uses the existing selection cohorts, including older online fraud. IBM calibration cohorts are used for selection of this new head. Views of the same source record receive inverse multiplicity weights; sampled negatives receive inverse inclusion weights. No class balancing is applied. IBM and authored sources each contribute half the fitting weight.

These are reused synthetic sources, not new external validation. Earlier unlabeled merchant inputs can contribute to later merchant history across customer groups, as they do within an uploaded file. No outcome feedback or future observations are features. The base models remain frozen.

## Selection results

All candidates are new log-loss CatBoost models followed by a fitted sigmoid probability mapping. Their inputs combine V8 and card-specialist margins, with optional transaction behavior features. Thresholds were selected on the selection population, never on the reserved customers.

| Candidate | Authored frauds found / 38 | False alerts / 2,067 | Cutoff | IBM selection constraint |
| --- | ---: | ---: | ---: | --- |
| Scores only | 2 | 0 | 82.54% | Failed |
| Relative behavior | 29 | 0 | 80.95% | Failed |
| Broader context | 31 | 0 | 93.22% | Failed |

The IBM constraint limits each cohort's precision and recall loss to two percentage points relative to the existing V8 reference decisions. None passed it. These authored numbers are selection results, not independent test results or evidence that a replacement is ready.

## Decision

Keep all three candidates offline. Do not spend the reserved evaluation on a candidate already failing selection. A separately versioned v2 study tests corrections to V8's existing log-odds and increased IBM fitting weight. It retains the same customer split and gates. No final outcomes were consulted when designing that revision.

The initial preparation attempt failed because older online caches omit physical-location categories. Preparation was repaired using the canonical missing-category sentinel before fitting. The initial protocol is archived at `.cache/authored-adaptation-v1-initial-protocol.json`; the current protocol records the repair. Source hashing, feature allowlists, customer isolation and exact baseline-score parity were independently checked.

Machine-readable evidence: [protocol](protocol.json), [prepared data](prepared.json), [all candidates](experiments.json), [frozen selection](frozen.json). Training: [script](../../../scripts/train_authored_adaptation.py).
