# Precision improved; the recall-floor requirement failed

The weighted sequence method significantly improved precision over the refitted incumbent at their frozen development-selected cutoffs. It reduced false alerts by 25.4%, at the cost of three additional missed frauds. **It did not meet the required 40% recall floor, so the overall acceptance gate failed and no model was activated.** The reserved July–December 2018 cohort is now consumed; its outcomes cannot be reused as an untouched test.

## Frozen confirmation result

The cohort contains 145,879 eligible purchases and 246 frauds across 26 users with fraud, among 269 users overall. Both methods have full score coverage. Cutoffs were chosen on separate validation-role users and frozen before scoring or joining confirmation outcomes. No cutoff was adjusted afterwards.

| Metric | Incumbent with precision-focused cutoff | Hard-negative sequence candidate |
| --- | ---: | ---: |
| Accuracy | 99.55% | 99.64% |
| Precision | 15.54% | **19.26%** |
| Recall | 37.40% | **36.18%** |
| F1 | 21.96% | **25.14%** |
| Alerts | 592 | 462 |
| Fraud detected | 92 | 89 |
| False alerts | 500 | 373 |
| Missed fraud | 154 | 157 |
| Alert share | 0.406% | 0.317% |

The precision gain is **3.72 percentage points**, approximately 24.0% relative. Its paired-user 95% interval is **+1.67 to +5.89 points**. Recall changes by **-1.22 points**, with interval **-4.04 to +1.36 points**, meeting the prespecified five-point noninferiority margin. All 4,000 paired bootstrap replicates were defined. The six-month block sensitivity also gives a positive precision-gain interval (+1.82 to +5.42 points); six blocks provide limited temporal evidence and are not a combined two-way uncertainty estimate.

The gate passed minimum sample/alert support, practical precision gain, precision significance and recall noninferiority. It failed the absolute recall floor for both policies. Candidate recall's user-bootstrap interval is 26.13–45.57%; this is not evidence that its true recall is certainly below 40%, but it does not satisfy the frozen observed-performance requirement. The gate was not relaxed or replaced after testing.

At the separate top-1% reference budget, both models detect 136/246 frauds: 55.28% recall and 9.32% precision. The benefit is concentrated in the smaller high-priority alert set. Fixed-cutoff policies and fixed-budget ranking answer different questions. The earlier v2 headline of 7.58% precision came from a different cohort and review budget; do not present 7.58% to 19.26% as a controlled model improvement.

![Development precision-recall curves and frozen confirmation policies with marginal user-bootstrap intervals](precision-recall.png)

The left panel is development evidence; the right panel shows only frozen confirmation policies. The overlapping marginal intervals on the right do not replace the paired precision-difference interval reported above.

## Implementation and development selection

The initial [v5 sequence experiment](../ml-v5/report.md) gained only 1.60 precision points on full-data development and failed the two-point screening requirement. Confirmation remained closed. The authorized fallback then tested exactly one chronological hard-negative recipe, frozen in the [design](design.md) and [protocol](protocol.json).

An unchanged incumbent EBM was fitted on 280,604 January–March 2018 fit-role purchases, including 357 frauds across 45 users. Its maximum fitting timestamp precedes its earliest April–June scoring timestamp. Among the latter period's 284,523 legitimate fitting purchases, the highest-scored 2%—5,691 rows—received weight four. Every fraud and every other purchase retained weight one. No validation or reserved labels entered mining. Fraud examples were not removed, and no negative was dropped.

The weighted sequence candidate was then fitted on the same 565,519 January–June purchases as the incumbent, including all 749 frauds across 77 users. Both methods average raw scores from seeds 20261024 and 20261025. The exact v5 incumbent packages were reused. Sequence features remain the nine prior account-history measurements; the candidate does not use shared merchant context or additional data. Raw scores are not calibrated fraud probabilities.

On the 103,876-purchase development cohort, precision rose from 18.92% to 24.91%, recall from 40.23% to 41.38%, and false alerts fell from 300 to 217. Both individual seeds improved precision, and quarterly guards passed. The candidate therefore advanced. The incumbent cutoff is -2.693064936590201; the weighted sequence cutoff is -3.1559082268161323. Each cutoff maximizes its method's development precision subject to at least 40% pooled recall. The model, cutoff and code were frozen, then 145,879 confirmation scores and alert decisions were hashed before outcomes were joined.

The implementation reuses v5 fixed-policy evaluation code through a process-local v6 configuration. It writes new models, mining evidence, predictions, reports and a separate label-access ledger. Source code and artifacts from v1–v5 are preserved. This avoids duplicating threshold and uncertainty logic; v5 and v6 commands must run in separate processes. The internal `sequence` result key denotes the weighted candidate for v6.

## What failed and what the evidence supports

Selecting a cutoff at roughly 40% recall on development did not ensure 40% on held-out users: the incumbent fell to 37.40% and the candidate to 36.18%. A development target at the minimum leaves little margin for transfer error. Future policy research should test a prespecified recall buffer and chronological threshold validation, with fresh confirmation evidence. It must not choose a replacement cutoff from this consumed test and claim independent validation.

Online coverage remains a concrete weakness: both frozen policies generated no online alerts and missed all 15 online frauds. Most positive evidence comes from chip purchases. Swipe has only 12 frauds; its segment results are descriptive. These observations do not justify removing difficult channels from the denominator.

The full reserved source contains 153,539 rows and 253 fraud labels. Positive-purchase eligibility excludes 7,660 rows, including seven fraud-labelled nonpositive rows. Headline metrics apply to the common eligible population. Shared history, repeated users, synthetic source semantics and earlier/later development exposure retain the historical-holdout limitations described in the protocol.

The confirmation establishes a precision benefit of this combined weighted-sequence policy over this incumbent policy. It does not isolate the causal contribution of sequence features versus weighting, prove superiority over CatBoost under the new objective, establish unchanged recall, or demonstrate real-bank effectiveness. The unweighted sequence model was not a second confirmation candidate. No winner was substituted after outcomes opened.

## Verification and delivery status

All **246 backend tests** pass, including seven new fixed-policy tests and three hard-negative tests. Strict typing covers 85 source files; lint and formatting pass. Independent fixtures cover complete score-tie groups, recall constraints, full confusion counts, literal row-resampling parity, undefined bootstrap outcomes, guard failures, ID-aligned context and labels, chronological mining eligibility, stable mining ties, and version-isolated outputs.

The loader matches all 39 original baseline/sequence measurements exactly on 103,876 development rows. Every serialized model reproduces every development score exactly, and native contributions reconstruct the raw scores. The verifier replays the chronological miner, training weights, development policy selection, all confirmation scores/alerts and the final numerical report. See [reproduction-check.json](reproduction-check.json) and [verification.json](verification.json).

The candidate fits took 22.5 and 26.0 seconds; the chronological miner took 9.4 seconds. The v6 process recorded a 1.09 GiB peak working set, within the 2.5 GiB budget. Loading, hashing and replay add wall time. A second complete training rebuild was not run. Frontend/browser checks were not rerun because application code and contracts were unchanged.

The offline incumbent and runtime rules remain unchanged. `plan.md`, `todo.md` and the project specification remain unchanged. [Reproduction commands](../ml-v5/reproduction.md) cover both precision stages. The portfolio claim supported here is a significant precision gain with a documented small recall loss and failed absolute recall requirement—not a fully accepted production upgrade.
