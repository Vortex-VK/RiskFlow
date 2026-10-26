# Trained probability outputs: implementation and mixed validation

The user requested a probabilistic model, rather than the previous display-only 0–100 index. RiskFlow now uses four fitted probability output models on top of frozen V8 and card-pattern-v5 evidence. New results report estimated fraud probability, the probability corresponding to the original review cutoff, and probability-model provenance. The base tree weights, feature builders, raw margins, and review decisions are unchanged. **This is a probability-output implementation, not a demonstrated accuracy improvement.**

The base classifiers already optimize a classification loss. Retraining the output stage was the missing operation: previously `100 * sigmoid(margin - cutoff)` was an unfitted display transformation. Now `100 * sigmoid(a * margin + b)` uses separately learned coefficients. The resulting system is a probabilistic estimator; it is not known to be well calibrated for arbitrary uploads. No complete retraining of V8's trees was performed or claimed.

## Training and selection

For each output, sigmoid logistic regression and isotonic regression were fitted and compared using four customer-grouped folds. That required 32 fold fits, followed by four final fits of the selected method. All four outputs selected sigmoid by out-of-fold log loss, with Brier score as tie-break. Logistic regression uses C=1, no class reweighting, and no fraud oversampling. Isotonic is a trained monotone alternative, not a threshold heuristic.

Every source transaction has total weight one across its available history views. All views of a transaction and all transactions for a customer remain in the same validation fold. Current labels, future records, customer IDs, and scenario annotations are not inference features. Customer IDs only determine offline folds. Source-row disjointness was checked against the corresponding base fitting cohorts. Models were frozen before final diagnostics; no evaluation outcomes were used to adjust them.

| Probability output | Development observations | Unique transactions | Unique frauds | Fraud customers |
| --- | ---: | ---: | ---: | ---: |
| V8 card | 139,360 | 69,680 | 92 | 16 |
| V8 online | 42,110 | 21,055 | 112 | 46 |
| Card specialist | 162,560 | 115,992 | 93 | 25 |
| Card prioritizer | 162,560 | 115,992 | 93 | 25 |

Card calibration uses the existing 2019Q3 customer-bucket-4 cohort. Online and review calibration combine 2016Q4 bucket 3 with 2019Q3 bucket 4, using long and short upload histories. Specialist calibration includes every eligible card, including V8 alerts, rather than only positive review suggestions. The specialist and prioritizer use the same population and must not be counted as separate data support.

These are reused synthetic development cohorts that previously participated in base-model threshold/architecture selection. The grouped validation assesses the newly fitted probability stage; it is not an unbiased estimate of the entire historical model-selection process. The original index baseline's cutoff had already seen these development outcomes, so its comparison with newly out-of-fold estimates is not fully symmetric. Calibration support is limited, particularly for the card route.

[Frozen protocol](protocol.json), [all candidate metrics and reliability groups](experiments.json), [support and fold audit](audit.json), [frozen coefficients](frozen.json).

## Probability cutoffs and decisions

| Output | Probability at the unchanged reference cutoff |
| --- | ---: |
| V8 card | 81.04% |
| V8 online | 75.93% |
| Card specialist proposal | 1.21% |
| Card prioritizer | 11.84% |

These are the learned probabilities corresponding to the **existing** margin cutoffs; they are not newly optimized probability thresholds. Fifty percent no longer has special decision meaning. Low specialist thresholds reflect its review role and weak evidence; they do not establish fraud. Suggestions still require an eligible card not already flagged by V8. Prioritization remains restricted to suggested leads. Probability scores are also available for eligible non-suggestions for inspection.

Probability estimates are clipped to [0.000001, 0.999999] for numerical stability, not as a confidence guarantee. Rankings, evaluation losses, and preview comparisons use unrounded values. Exact raw-margin comparisons retain the original decisions, including floating-point boundary cases. The preview uses the chosen probability cutoff and does not modify saved reference decisions.

## Results and regressions

Lower Brier score, log loss, and RMSE are better. The old index is treated numerically as a forecast solely to make this comparison; it was never a fitted probability model. Both forecasts use the same numerical clipping for log loss. See the older score-error report for unclipped display-index error measurements.

| Population / output | Previous index RMSE | Trained probability RMSE | Previous log loss | Trained log loss |
| --- | ---: | ---: | ---: | ---: |
| Primary IBM, all V8 routes, long history | 0.599 | **0.760** | 0.000208 | **0.000290** |
| Primary IBM, all V8 routes, short history | 0.782 | **0.966** | 0.000300 | **0.000417** |
| Primary IBM, eligible card specialist | 4.494 | 3.048 | 0.013225 | 0.006715 |
| Primary IBM, eligible card prioritizer | 3.190 | 3.037 | 0.008356 | 0.006195 |
| Authored scenarios, all V8 routes | 20.909 | **24.562** | 0.220404 | **0.290000** |
| Authored scenarios, eligible card specialist | 9.445 | **10.458** | 0.038841 | **0.057960** |
| Authored scenarios, eligible card prioritizer | 9.165 | **10.152** | 0.033078 | **0.048039** |

The primary V8 Brier score increases from approximately 0.00003584 to 0.00005773; the authored-scenario Brier score increases from 0.043719 to 0.060329. A trained probability output therefore does not establish better forecasting than the old index on these diagnostics.

Class-specific results explain some of the tradeoff. Primary V8 fraud-only RMSE improves from 11.95 to 8.36, while legitimate-only RMSE worsens from 0.50 to 0.72. On authored scenarios, fraud-only RMSE improves from 72.40 to 66.68 while legitimate-only RMSE worsens from 18.69 to 23.08. The authored card-route fraud probabilities remain close to zero. The learned mappings cannot recover missing ranking/feature information or guarantee transfer between generators.

The card specialist's improved aggregate IBM loss is not improved fraud detection: its fraud-only RMSE worsens from 95.66 to 99.75 as estimates shrink toward the low development prevalence. The prioritizer shows the same issue. Reliability groups and class-specific errors are therefore shown alongside overall losses. Native online evaluation contains no fraud, so it cannot establish online fraud calibration. Two older online cohorts show mixed log-loss changes (0.001881→0.002291 and 0.006405→0.006345).

No claim of improved detection or general calibration is made. All existing V8 reference decisions matched the frozen caches across 990,196 native history-view observations and 10,000 authored transactions. Long/short views reuse records. The supplied scenarios and native diagnostics were previously exposed in earlier research; they are not fresh independent validation.

[Full evaluation, class-specific errors, Brier scores, and reliability bins](evaluation.json). Per-row probability caches are in `training_data/probability-v1/predictions-*.parquet` with recorded hashes.

## App and API

New `model.score`, `cardScores.pattern`, and `cardScores.priority` values use version `fraud-probability-v1`; `value` is the estimated probability times 100. `probabilityAvailable` is true, `probabilityBundleSha256` identifies the fitted output models, and `calibrationScope` is `ibm_synthetic`. `referenceValue` is each model's mapped probability cutoff. Raw margins, raw cutoffs, distances, and existing base-model identities remain available. `uploadDomainValidated` remains false. The card-review object's separate raw-margin evidence continues to declare that those raw margins are not probabilities.

The UI displays percentage estimates with the source limitation, preserves old `margin-index-v1` results with their original meaning, and supports per-model probability cutoff previews. Results include Brier score, log loss, overall/fraud/legitimate RMSE, and a reliability table comparing mean predicted probability with observed fraud rate in labeled groups. Unlabeled rows contribute to workload only. Raw-margin ranking metrics remain separate from probability losses; neither the ranking metric nor a small global calibration error establishes general reliability.

CSV exports identify percentage probability, score version, and fitted package hash. Retained assessments save the new fields and include the probability package and version in their analysis hash. The API health check requires the probability package; a missing or corrupt package fails explicitly. Frontend decoding verifies the formula, package identity, scope, raw margin, original cutoff, and probability metadata. Historical runs without probability output remain readable.

Machine-readable [probability specification](../../../contracts/probability-spec.json) and [OpenAPI](../../../contracts/openapi.json). Installed probability manifest SHA-256: `c502560911caa3464ce7cadf5a662a0d4200d74a86c456614061bac272ca197f`.

## Checks and reproduction

351 backend tests, 234 frontend unit tests, and seven targeted browser tests passed. Backend Ruff, strict mypy (142 files), frontend TypeScript/ESLint, and the production build passed. Browser checks cover scores, probability losses, cutoff reset/preview, CSV export, accessibility, custom-data imports, retained results, and unchanged V8 reference decisions. Frozen research scripts retain their recorded hashes, including their long protocol text lines.

Set `PYTHONPATH=backend` and use `backend/.venv/Scripts/python.exe`. `scripts/train_probabilities.py` fits/freezes the probability stage and refuses to overwrite existing protocol/package outputs. `scripts/evaluate_probabilities.py` evaluates the frozen package and refuses to overwrite its result. Runtime requires only the packaged JSON and base model bundles, not training data or sklearn. An initial pre-freeze arithmetic bug in log-loss calculation was corrected before any candidate was selected; the initial protocol is archived in `.cache/probability-v1-initial-protocol.json`.

The implementation follows the distinction between fitting a probability calibrator and choosing an operating threshold described in the [scikit-learn calibration documentation](https://scikit-learn.org/stable/modules/calibration.html). Independent probability fitting can improve interpretation, but neither the fitting procedure nor a probability-shaped output guarantees calibration on another population.
