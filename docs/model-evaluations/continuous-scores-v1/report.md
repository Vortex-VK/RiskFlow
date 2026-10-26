# Continuous model scores

Implemented 2026-10-25. Upload-v8 and card-pattern-v5 now expose continuous evidence for inspection, ranking, and threshold evaluation. Both already produced real-valued margins; no retraining or model replacement was necessary. The frozen weights, reference cutoffs, existing alerts, specialist suggestions, and priorities are preserved.

## Score specification

`margin-index-v1` displays `100 * sigmoid(raw_margin - reference_threshold)`. This is a monotone presentation scale, **not a calibrated probability**. A score of 80 does not mean an 80% fraud chance. Fifty corresponds to the existing reference cutoff. Margin distance shows how far a transaction is from that cutoff; it is not a causal explanation or a confidence interval. Compare scores within one model/route, not across routes or as an average of the models.

| Output | Population | Frozen raw-margin cutoff |
| --- | --- | ---: |
| V8 card (`coverage`) | Supported chip/swipe purchases | 2.485474202331682 |
| V8 online (`online_specialist`) | Supported online purchases | 1.8637710412616648 |
| Card specialist (`card_pattern`) | Supported cards with at least 10 prior completed purchases | -1.8899241882241695 |
| Card prioritizer (`card_priority`) | Same eligible cards; operational priority remains restricted to suggested leads | -1.0691764979048273 |

The API's `event.model.score` contains `value`, `rawMargin`, `referenceThreshold`, `distance`, `source`, `version`, `referenceValue: 50`, and `probabilityAvailable: false`. `event.cardScores` contains both `pattern` and `priority` scores, history support, bundle identity, and the existing suggestion/priority flags. These specialist scores are available below their cutoffs and when V8 already alerts. Online transactions, insufficient card history, or an unavailable optional specialist have no card score; absence is not zero risk.

`cardPattern` remains the additional-review evidence for suggested leads. `model.alert`, `decision`, and the headline confusion metrics remain reference-threshold outcomes. Legacy rule-engine `rawScore`/`riskScore` fields remain null for learned models. Saved assessments include the new score fields and score version in their analysis hash. Old saved runs without the new fields remain readable, without inventing historical scores.

The generated [machine-readable specification](../../../contracts/score-spec.json) takes its cutoffs from hash-checked model manifests. [OpenAPI](../../../contracts/openapi.json) and TypeScript contracts describe the additional fields. Frontend decoding checks score identity, formula, underlying margin, route, alert consistency, and specialist eligibility.

## App behavior

Inspect a payment to see continuous scores, a meter, distance from the reference cutoff, and expandable raw calculations. Open **Results → Scores and threshold explorer** to select a model, rank transactions, download their exact scores as CSV, and preview another cutoff. The preview compares workload, labeled fraud detections/misses, legitimate flags, precision, and recall with the reference cutoff. It does not change saved decisions or headline metrics.

Average precision (AP) and ROC AUC use exact raw margins with tie handling. Metrics are calculated separately by model/route and require both labeled classes in this interface. Unlabeled rows contribute to workload only. Comparisons use unrounded margin distance, including around the reference boundary: a displayed 50.00 can still be slightly below cutoff. Endpoint previews select all finite scores at 0 and none at 100. A rounded display index cannot create a reference alert.

## Ranking diagnostics

These are **reused synthetic evaluation populations**, not fresh independent validation. The specialist rows include all eligible cards, including fraud already caught by V8; AP here is not an incremental fraud-detection rate. Long and short views reuse source transactions and must not be counted as independent samples. The authored scenarios are a separate source with different fraud prevalence and patterns.

| Population | Score | Rows | Fraud labels | AP | ROC AUC |
| --- | --- | ---: | ---: | ---: | ---: |
| Primary IBM, longer history | V8 card | 289,729 | 263 | 0.997024 | 0.999997 |
| Primary IBM, shorter history | V8 card | 289,729 | 263 | 0.994433 | 0.999995 |
| Primary IBM, longer history | Card specialist | 251,086 | 234 | 0.005005 | 0.830957 |
| Primary IBM, longer history | Card prioritizer | 251,086 | 234 | 0.025050 | 0.889143 |
| Authored scenarios | V8 card | 6,357 | 61 | 0.374208 | 0.985013 |
| Authored scenarios | V8 online | 3,643 | 119 | 0.111784 | 0.857329 |
| Authored scenarios | Card specialist | 5,484 | 61 | 0.363263 | 0.944375 |
| Authored scenarios | Card prioritizer | 5,484 | 61 | 0.591900 | 0.976107 |

The native online subsets contain no fraud, so AP/AUC are reported as unavailable. V8's strong native card ranking does not transfer into similarly strong authored-scenario precision. The specialist's low native AP also remains visible despite moderately high ROC AUC: class imbalance makes ROC AUC alone an inadequate summary. The prioritizer's scenario ranking does not establish a reliable standalone fraud classifier. Continuous scores improve visibility and threshold analysis; they do not fix these model limitations or establish probability calibration.

[Full numeric results](evaluation.json) include all four native history views, the authored scenarios, and descriptive cutoff previews at 25/50/75. No preview cutoff was selected for deployment. No Brier score or probability log loss is reported for these uncalibrated indices.

## Verification and reproduction

The evaluator verifies every V8 reference decision against the frozen caches across **990,196 native history-view observations**, plus 10,000 authored transactions. Specialist suggestion and priority confusion counts match the existing v5 receipts on every population. Tests additionally check below-cutoff scores, suppression of suggestions without removing scores, causal prefixes, label independence, retained-score round trips, corrupt score rejection, ranking ties, and unrounded threshold boundaries. Browser tests exercise the score display, slider, CSV export, accessibility, retained results, and historical device-context invariance.

Checks: 348 backend tests, 232 frontend unit tests, and four targeted browser tests passed. Backend Ruff and strict mypy (140 files), frontend TypeScript/ESLint, and the production build passed. The changed frontend files pass formatting checks; the repository-wide formatting command still reports nine previously unformatted files outside this change. Desktop score panels were visually inspected, and the restarted local API serves the new score fields.

From the project root in PowerShell, set `$env:PYTHONPATH='backend'` and run `backend/.venv/Scripts/python.exe scripts/evaluate_continuous_scores.py`. The evaluator refuses to overwrite an existing report. No fitting or threshold tuning occurs.
