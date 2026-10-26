# RiskFlow ML v1: completed experiment, no engine promotion

The bounded IBM experiment is implemented and evaluated. The frozen logistic candidate improved the observed top-1% recall over the current rules, but the reserved population contained only **19 fraud transactions across three users**. It failed the predeclared evidence-support and uncertainty gates. The application therefore retains its existing rule engine. No learned UI, runtime package, probability output or claim of algorithmic superiority is released.

## Reserved results

June 2018, users excluded from all supervised fitting, with their prior unlabelled history available. Every model ranks the same 23,748 eligible purchases; the review budget is 238 transactions. All models scored every eligible row.

| Model | Fraud found / 19 at 1% | Recall at 1% | Precision at 1% | Average precision | Recall at 2% | Recall at 5% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rules (R0) | 1 | 5.3% | 0.42% | 0.00261 | 10.5% | 26.3% |
| **Logistic: frozen candidate** | **8** | **42.1%** | **3.36%** | **0.08972** | **57.9%** | **78.9%** |
| Standard CatBoost | 12 | 63.2% | 5.04% | 0.14864 | 73.7% | 100.0% |
| Personalized CatBoost | 12 | 63.2% | 5.04% | 0.16515 | 73.7% | 89.5% |
| Explainable boosting (EBM) | 14 | 73.7% | 5.88% | 0.23544 | 94.7% | 100.0% |

![Reserved synthetic benchmark; insufficient support for promotion](comparison.svg)

The candidate's absolute recall difference from R0 is **+36.8 percentage points**, with paired user-cluster 95% interval **−25 to +75 points**. Against standard CatBoost, the difference is **−21.1 points**, interval **−50 to 0 points**. Only 948 of 1,000 bootstrap replicates contain any fraud; undefined replicates are counted and excluded from interval calculation. These wide intervals are descriptive given the very small number of positive users. The frozen support minimum was 30 fraud transactions and ten positive users.

The separate time-block sensitivity interval against R0 is +7.7 to +52.9 points. There are only five June blocks, and this result does not override the failed primary user-cluster comparison. Coarse R0 scores are tie-sensitive: ten alternate identity-hash tie orders find one or two frauds, compared with one in the frozen primary ordering.

The higher EBM point estimate is a secondary result, not permission to switch the candidate after testing. Personalized CatBoost found the same number of frauds as standard CatBoost at 1% and 2%, and fewer at 5%. This experiment does not establish an incremental detection benefit from personalization.

## Why logistic was selected

Initial fitting used 190,732 purchases, including 278 frauds across 34 users. The primary unseen-user selection period contained 8,445 purchases but only 12 frauds across three users, below the frozen minimum of 20 frauds and five users. The predeclared conservative fallback selected logistic regression rather than searching configurations on these sparse outcomes. Four fixed learned comparisons were retained; there was no hyperparameter search. Known-user and weekly validation are diagnostics only.

All four learned models were then refitted on the same 280,363 development purchases through May 15. The May 16–23 calibration block contained 32 frauds across ten users, below the required 50 frauds. Calibration was omitted; the raw ranking score is not presented as a validated fraud probability. The independent May 24–31 block supplied a fixed review threshold. On June it marked 275 purchases rather than exactly 238, illustrating why a threshold is different from retrospective top-1% ranking.

## Population, chronology and exclusions

The unchanged 2.35 GB source contains 24,386,900 rows. A sequential pass selected 852,858 January–June 2018 records. Of these, 811,484 positive purchase attempts received features; 41,374 zero/negative records were retained in accounting but excluded from the learned purchase target. No exact duplicate occurrences were found in this slice; the extractor preserves them when present.

The reserved June source has 24,939 rows and 21 fraud labels. The eligible population has 23,748 rows and 19 fraud labels; **1,191 excluded rows contain two fraud labels**. Eligible coverage of 100% must not be described as full-source coverage or detection of all fraud. The three positive users account for 11, four and four eligible frauds. There are 13 account/day incident proxies, with at most four fraud rows in one proxy; these are not verified independent fraud incidents.

Grouping, periods, support thresholds, candidate route and upgrade criteria were frozen before reserved scoring. Labels reside in separate outcome databases. Predictive features exclude current status/errors, identity memorization, labels and future aggregates. Equal-time learned features share the same preceding state. The existing rules preserve their own equal-time semantics. Source minute timestamps use an explicit synthetic UTC convention; real authorization availability and fraud-confirmation times are unknown.

Channels, weekly segments, supported history and no-history segments appear in [results.json](results.json). Only four reserved purchases have no prior completed history, with no fraud labels, so cold-start detection quality is unmeasured. Arbitrary CSVs, date-only timing, missing channels, linked payment lifecycles, non-USD records and truncated-history equivalence claims are outside the learned input contract.

## What is implemented and verified

- Chronological extraction, source hashing, stable identities, separate outcomes, deterministic user splits, bounded SQLite/Parquet intermediates and failure staging.
- Thirty shared historical features, explicit missingness/fallback behavior and compact support recipes; [the dictionary](feature-dictionary.md) specifies units and boundaries.
- Training-fitted preprocessing, logistic/CatBoost/EBM packages, frozen candidate selection, calibration support checks, prediction hashing before outcome joins, and reproducible reporting.
- Common-population metrics, exact review budgets, coverage, excluded fraud, user clustering, time-block sensitivity, rule-tie sensitivity, weekly/channel/history slices and separate threshold diagnostics.
- Current-engine and import/feature parity on **10,983 purchases across 20 development users**. The same full-history demo reproduces identical offline/model predictions after actual import.
- A bounded feasibility spike covering import, projection, current assessment, immutable saved-run reopening, learned feature generation, inference, score persistence through a fresh SQLite connection, and linear contribution arithmetic. Logistic contributions reconstruct scores within `3.6e-15`; this is an explanation capability, not measured analyst productivity.
- A second candidate seed produced identical validation scores. The deterministic fallback did not use the reserved test for selection.

The pipeline's promotion branch ended at milestone 5 because the evidence gate failed. Backend/UI learned-assessment integration, clean-checkout runtime package installation, model activation and learned graph inspection were intentionally not undertaken. Existing retained assessments and simulator behavior remain in place. The local research demo CSV contains no labels and preserves the selected development user's available January–June context; importing it today demonstrates the current rule workflow, not a released learned UI.

## Resources and reproducibility

The measured machine has approximately 15.4 GiB RAM and 16 logical CPUs. Models ran sequentially with two training threads. Extraction took about 142 seconds and feature generation 73 seconds. The feature pass sampled peak resident memory at 159 MiB. Post-fit process snapshots were at most 812 MiB; those snapshots are not a continuously sampled training peak. The frozen research budget was half physical RAM, with complexity bounded to four fixed models.

The 561-row development demo, including 541 scored purchases, completed import/current-rule assessment/features/inference/persistence in approximately 2.44 seconds, below its 45-second feasibility budget and the existing 60-second retained-assessment timeout. The candidate pickle is 6,330 bytes. Loading and scoring 23,748 cached test feature rows took approximately 0.064 seconds for logistic regression; this excludes feature construction, explanations, network transport and UI work. It is not a full application latency claim.

The Python environment is locked in `backend/uv.lock`, with ML dependencies in an optional group. Normal application imports do not load the research models. Pickles are local project-produced artifacts, never accepted through an import/API parameter. Raw rows, outcomes, feature caches, demo exports and estimators remain under ignored `training_data/`; versioned documentation contains aggregate results and provenance only.

Follow [reproduction.md](reproduction.md) to verify the original frozen result or run the full workflow in a separate directory without replacing it. [predictions.json](predictions.json) records the final scoring/report code, input contract, models and prediction hash; [frozen-models.json](frozen-models.json) records the earlier training checkpoint. Formatting, data-access guards and reporting/feasibility code were finalized between these checkpoints; predictive model definitions and the shared feature implementation were checked unchanged before scoring. The feature dictionary was formalized before reserved scoring. An initial development-only SQL support inspection preceded the automated label-access ledger; it did not access reserved outcomes. The ledger records subsequent pipeline accesses.

Verification: 215 backend tests passed, including 11 ML tests with negative controls; backend Ruff checks/formatting and strict application/ML typing passed. New tests cover independent feature values, future/equal-time invariance, late availability, expiry, account isolation, duplicates, malformed labels, feature/outcome separation, unknown-outcome rejection, ranked budgets, abstentions, bootstrap direction, frozen-outcome access and failed promotion conditions. No frontend changes required a new frontend test run. `plan.md`, `todo.md` and the original project specification retain their recorded hashes.

A complete second run (`ml-reproduction-01`) rebuilt extraction, features, all fitted models, import parity, feasibility, predictions and reporting in a separate directory. Its feature cache is byte-identical, every final prediction matches exactly for all five comparisons, and all numerical reports/gates agree. Underlying cache hashes were verified for both runs; a corrupted-cache negative control was rejected. See [verification.json](verification.json). This confirms reproducibility of the same consumed experiment, not independent statistical replication.

## Portfolio statement and next hypothesis

A defensible description is: **“Built a reproducible, leakage-controlled fraud-ranking experiment with four learned models, strict temporal/user separation, baseline parity, uncertainty estimates and an explicit deployment gate. Detected that the reserved evidence was too concentrated to justify promotion and preserved the existing engine.”** The project now demonstrates ML engineering and evaluation discipline; it does not yet demonstrate a validated novel detection algorithm.

The next experiment should test whether EBM or standard CatBoost retains its apparent benefit across a longer, independently reserved period with substantially more fraud-bearing users. Compare personalization as a fixed ablation rather than assuming it helps. First inspect label-independent date coverage in the existing IBM source and design new development/reserved periods; do not expand June repeatedly until a result passes. This June cohort is now consumed. A wider IBM protocol requires a new version and frozen selection policy.

Additional online data is **not required to complete v1**. A genuinely independent labelled source could later test transfer beyond IBM's synthetic patterns. Different column names are an adapter issue; useful compatibility requires account/instrument identity, event timestamps, amounts/currency, purchase semantics, outcomes and a trustworthy explanation of how labels and historical fields were produced. A larger CSV without those properties may add volume without adding valid evidence.
