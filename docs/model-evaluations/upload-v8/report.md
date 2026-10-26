# Upload-v8: 95/95 on IBM, with broader regressions

The new offline candidate reaches **97.01% precision and 98.86% recall** on the existing 334,777-row IBM longer-history evaluation. It keeps the same 260 true positives and reduces false alerts from 20 to eight. **Upload-v7 remains installed:** the candidate misses more older online fraud, increases false alerts on the supplied scenarios, and regresses in an unsupported Sparkov input-sensitivity test. This is a useful benchmark improvement, not a generally better fraud model.

All results below use frozen models and development-only thresholds. These IBM and supplied-scenario populations have already been inspected in earlier research; they are reused diagnostics, not new independent confirmation. IBM describes TabFormer credit-card data as [synthetic](https://github.com/IBM/TabFormer). Neither the IBM result nor authored scenario outcomes establish bank reliability.

## Same records, different policies

The main candidate is `precision95`: retain the installed v7 card detector, replace its older online route with a newly trained online specialist, and choose the online threshold using separate calibration. The policy name describes its calibration criterion, not a guarantee about another dataset.

| Population | Transactions / fraud | v7 precision / recall | Candidate precision / recall | v7 TP / FP | Candidate TP / FP |
| --- | ---: | ---: | ---: | ---: | ---: |
| IBM 2019H2, longer histories | 334,777 / 263 | 92.86% / 98.86% | **97.01% / 98.86%** | 260 / 20 | 260 / 8 |
| Same IBM source rows, short histories | 334,777 / 263 | 85.22% / 94.30% | 96.12% / 94.30% | 248 / 43 | 248 / 10 |
| IBM Q4 diagnostic, longer histories | 160,321 / 132 | 92.54% / 93.94% | 98.41% / 93.94% | 124 / 10 | 124 / 2 |
| Same diagnostic source rows, short histories | 160,321 / 132 | 85.14% / 95.45% | 96.92% / 95.45% | 126 / 22 | 126 / 4 |
| Older IBM online transactions, two disjoint 2018 cohorts | 32,072 / 46 | 71.11% / 69.57% | **96.55% / 60.87%** | 32 / 13 | 28 / 1 |
| Supplied scenario CSV | 10,000 / 180 | 15.69% / 23.89% | **15.50% / 40.56%** | 43 / 231 | 73 / 398 |

Long and short views contain the same source transactions; their denominators must not be added as independent evidence. The primary IBM population has 34 fraud-bearing customers, mostly seen during earlier card fitting. Its frauds are 260 chip and three swipe transactions, with **zero online fraud**. Consequently, suppressing online alerts improves that aggregate without testing online recall. The older online cohorts expose the cost: four additional missed frauds, a recall decline of 8.70 percentage points. Their combined 46-fraud support is small.

The main candidate's whole-customer bootstrap 95% intervals on the primary evaluation are **91.40–100% precision** and **96.90–100% recall**. Its paired F1 improvement interval is +0.0102 to +0.0387, conditional on the fitted models and this source. A 97.01% point estimate does not establish that precision is at least 95% with confidence. The scenario paired F1 interval crosses zero (-0.0131 to +0.0810).

[Evaluation counts](evaluation.json), [independent verification and intervals](verification.json), [promotion decision](decision.json).

## Other fraud patterns

These are the supplied CSV author's labels, not original IBM rows or confirmed bank outcomes. Patterns are evaluation-only metadata and never enter the predictors. Precision within an all-fraud pattern would be misleading; the table therefore reports detections and recall, with false alerts measured separately on legitimate rows.

| Fraud pattern | Cases | v7 caught / recall | Candidate caught / recall |
| --- | ---: | ---: | ---: |
| Account takeover online | 42 | 19 / 45.24% | 27 / 64.29% |
| Card testing | 26 | 2 / 7.69% | 8 / 30.77% |
| Counterfeit swipe | 26 | 0 / 0% | 0 / 0% |
| Electronics cash-out | 35 | 0 / 0% | 0 / 0% |
| International online | 51 | 22 / 43.14% | 38 / 74.51% |

The candidate finds 30 additional frauds but produces **167 additional false alerts**. Among legitimate scenario groups, new false alerts include four large purchases, seven unfamiliar online purchases and 18 recurring subscriptions; v7 had zero in those groups. Most false alerts remain in ordinary transactions: 255 versus 162, plus 114 versus 69 in ordinary/travel transactions. Neither model flags the specifically labeled legitimate fast-repeat or legitimate-travel groups. These are small authored groups, not evidence that all travel or subscriptions are handled well.

Every one of the 61 counterfeit-swipe/electronics scenario frauds remains missed. The new online model cannot repair these card-channel failures. Card decisions are identical by construction and verified across all four IBM evaluation views.

[Full scenario and channel breakdowns](scenarios.json), [prediction freeze](scenario-prediction-freeze.json).

## External data compatibility and sensitivity

Locally available public datasets were inspected before selecting a transfer test. Their field contracts matter:

| Dataset | Can v7 be evaluated with its actual required inputs? |
| --- | --- |
| IBM TabFormer | Yes, native supported fields; same synthetic generator as fitting |
| Supplied 10,000-row scenarios | Yes, compatible schema; author-defined outcome labels |
| Sparkov | No native four-digit MCC, exact chip/swipe/online method, completion status or merchant city/state/ZIP |
| Fraud Detection Handbook | Account, terminal, amount and time available; required MCC/channel/status absent |
| BankSim | Daily simulation steps, missing MCC/channel/status; not precise transaction times |
| IEEE-CIS | Anonymized competition predictors cannot be substituted for ordinary-upload features |

A separate **unsupported sensitivity test** scores the first 100,000 original Sparkov `fraudTrain.csv` records, without outcome-based sampling. They span January 1–February 28, 2019 and contain 922 accounts and 990 labeled frauds. Files are nonoverlapping 10,000-row windows; history resets between windows. No Sparkov outcomes enter model fitting or threshold selection. Earlier project research has already used this public source, so it is not globally unseen project data.

Because required fields are absent, the test explicitly assumes unknown MCC `0000`, empty merchant geography, completed transactions and UTC for the naive clock. It runs three separate assumed channels over exactly the same records. Home address is never substituted for merchant location. Merchant names become deterministic IDs; they are not model features. Source amount units are retained, without asserting verified currency conversion. All assumptions are in the [frozen transfer protocol](transfer-protocol.json); the app importer was not changed to apply them.

| Assumed channel | v7 precision / recall | Candidate precision / recall | v7 TP / FP | Candidate TP / FP |
| --- | ---: | ---: | ---: | ---: |
| Chip | Undefined / 0% | Undefined / 0% | 0 / 0 | 0 / 0 |
| Swipe | Undefined / 0% | Undefined / 0% | 0 / 0 | 0 / 0 |
| Online | 2.35% / 13.54% | **0.57% / 5.76%** | 134 / 5,561 | 57 / 9,934 |

No channel is chosen retrospectively as the preferred answer. This is evidence that forced field mappings are unreliable; it is **not a valid estimate of performance on native Sparkov or real bank transactions**. Missing inputs and source shift cannot be disentangled by this test. All channel conditions reuse the same 100,000 rows.

[Sparkov results](sparkov.json), [prediction freeze](sparkov-prediction-freeze.json), [generator reference](https://github.com/namebrandon/Sparkov_Data_Generation).

## Experiments and selection

Three new CatBoost online models train on **130,118 online transactions containing 1,750 frauds**, from January 2015 through June 2016, customer buckets 0/1. Existing causal file-local feature caches retain full histories before restricting fitting to online transactions. No identity, label, scenario or delayed confirmed-fraud feature enters the estimator.

Selection uses 2016Q3 bucket 2 and 2019Q3 bucket 2 online rows under wide and short histories: 19,580 distinct transactions and 146 distinct frauds. Calibration uses 2016Q4 bucket 3 and 2019Q3 bucket 4: 21,055 distinct transactions and 112 distinct frauds. All three roles are source-row disjoint; evaluation rows are also excluded. Short historical features are rebuilt from complete uploads before filtering online rows. Every model uses 400 trees, learning rate 0.06, L2 10, seed 20261025 and two threads.

| New model | Selection wide precision / recall | Selection short precision / recall |
| --- | ---: | ---: |
| Context, depth 6, positive weight 1 | 82.95% / 73.29% | 73.24% / 71.23% |
| Deep context, depth 8, positive weight 3; selected among new models | 83.21% / 78.08% | 72.41% / 71.92% |
| Relative-feature variant, depth 6, positive weight 3 | 41.96% / 41.10% | 33.10% / 32.88% |
| Existing v7 online route, unchanged baseline | 92.31% / 73.97% | 82.95% / 73.29% |

The relative variant removes direct category, absolute amount levels and calendar features; derived category histories remain. It does not solve transfer by merely removing these columns. Selection maximizes the worst history-view min(precision, recall), then pooled F1. **The existing baseline outperforms even the selected new model on that balanced selection objective.** Selection among new models does not establish superiority to the incumbent.

The selected depth-eight model is retained without refitting. Separate calibration freezes three evaluation policies:

- Balanced replacement: online margin >= **0.22527103423768172**. Online calibration recall is 76.79% in both views, below v7's 80.36–82.14%.
- Precision95 replacement: online margin >= **1.8637710412616648**, maximizing worst-view recall subject to empirical precision >=95% and at least 20 alerts in each view. Calibration recall is only **67.86–68.75%**. This is the main candidate reported above.
- Confirm95: retain an existing online alert only if the new model also exceeds the precision95 threshold. This catches only 37/180 supplied scenario frauds, versus v7's 43, and 25/46 older online frauds, versus 32. It is not an acceptable shortcut.

Balanced replacement catches more supplied scenario frauds (102/180), but produces 903 false alerts and lowers primary IBM precision to 90.59%. Every predeclared policy is recorded; none was tuned after evaluation.

[Protocol](protocol.json), [all three fits](experiments.json), [frozen model and calibration](frozen.json). Frozen candidate SHA-256: `fe5e3dc72f0c30ea882105e5f9360d9898d4e83ff3a62b73c23eca974d504994`.

## Decision and next direction

Keep **Upload-v7 / balanced** in the app and preserve v8 as an offline experiment. The primary IBM 95/95 point target is met; the broader-quality requirement is not. Do not put an unqualified 95/95 claim in the app or change its curated CSVs to conceal misses.

The next useful research direction is better-supported online and card-pattern coverage with a separate development/evaluation boundary, rather than optimizing these consumed IBM tests again. For general uploads, a model needs an input contract actually shared by its training sources (account, merchant, time, amount) and domain-specific calibration or experts where supported. Earlier portable/multisource experiments already failed transfer, so merely pooling those sources again is not a demonstrated solution. Any new sequence features or specialized heads should be compared against those frozen baselines and tested with entire generators and fraud-pattern families held out. Preserve unsupported/unknown outcomes rather than inventing required inputs or treating unscored cases as safe.

This is a proposed follow-up, not a claim that a general model has been built. The delivered work is three trained candidates, three frozen operating policies, native/online/pattern/compatibility diagnostics, a recorded decision, and independent verification.

## Reproduction and checks

From the project root, set `PYTHONPATH=backend` and use `backend/.venv/Scripts/python.exe`:

```text
-m ml.upload_precision prepare
-m ml.upload_precision train
-m ml.upload_precision_transfer freeze
-m ml.upload_precision evaluate
-m ml.upload_precision_transfer scenarios
-m ml.upload_precision_transfer sparkov
-m ml.upload_precision_verify
```

Recorded stages refuse to overwrite frozen results. Archive/copy the experiment into a new study version before running another cycle. Reproduction requires the hash-checked local IBM caches, v7/v13 artifacts and existing Sparkov archive; raw research data is not shipped into the app.

Validation: **26 targeted tests passed**, including seven new threshold/policy/adapter tests; strict type checks and lint passed for the new code. The independent audit reproduces **268 confusion matrices**, checks split disjointness, unchanged card decisions, v7 baseline parity, model/data hashes and preserved v7 code/bundle. Prediction files are hashed before transfer metrics are computed. Two pre-evaluation preparation corrections (lint wording and schema-safe merchant IDs/millisecond timestamps) are retained as separate receipts with the original protocols; neither changed populations, thresholds, outcomes or models. No app/runtime/UI files or sample CSV bytes changed.
