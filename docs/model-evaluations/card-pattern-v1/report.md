# Frozen v8 and a separate card-pattern reviewer

Upload-v8 / precision95 is installed following the user's explicit selection of that candidate after reviewing its regressions. Its frozen threshold, models and predictions are unchanged. The new `card-pattern-v1` specialist produces **additional investigation suggestions only**. It never changes v8 alerts, decisions, model margins or reported fraud metrics.

The reviewer finds some previously missed authored patterns, but does not establish a generally better fraud detector. On the primary IBM evaluation it produces 216 additional suggestions, all legitimate, and no additional fraud detections. This limitation is part of the delivered result, not a reason to merge its suggestions into the benchmark headline.

## Application behavior

- The active engine is `engine-ml-upload-v8`, model `ml-upload-v8`, policy `precision95`, assessment `assessment-v2.8`.
- Results contains a collapsed **Experimental card reviews** panel. Each suggestion opens the payment explanation with actual prior-history observations, an experimental-scope explanation and optional raw reviewer margin details.
- Suggestions retain the v8 result **no model alert**. They are separate from the model's review decision, graph decision colors, confusion counts and model-only cost estimates. Where truth labels exist, the panel separately counts fraudulent and legitimate suggestions. Labels never enter inference.
- Saved assessments retain and reopen the same review evidence. Their analysis hash includes both bundle identities and review availability. Older V13, v5 and v7 records remain readable with their original identities.
- If the optional reviewer is unavailable, v8 still scores the run. The UI explicitly reports that additional review suggestions could not be produced. A missing v8 model remains an error; there is no rule-score fallback.
- **Samples → Open card-review demo** loads 186 authored purchases from two accounts. This curated example produces four suggestions: three labeled frauds and one legitimate purchase. V8 separately has zero detections and six false alerts on this small file. It is not an original IBM source sample or independent validation. [Demo provenance](demo.json).

## What was trained

The new model uses earlier native IBM card transactions from January 2015 through June 2016, customer buckets 0/1, with the original showcase customers excluded. This provides **844,082 card purchases and 315 frauds: 172 chip and 143 swipe**. These earlier domestic cases broaden the behavioral training beyond the v7 card model's largely Italian fraud cohort.

Features are strictly prior, file-local relative amount, frequency, repetition, failure-history and payment-method-change measures. Absolute country/city, raw MCC/category, identity, calendar date/hour, absolute amount levels, fraud labels and v7 teacher scores are excluded. Derived category-history measures remain. No device or card-authentication information is invented. This is a generic card-pattern reviewer, not a classifier of counterfeit-card or cash-out mechanisms.

Two CatBoost configurations were tested: depth four / fraud weight three and depth six / fraud weight five. Both use 300 trees, learning rate 0.06, L2 10, seed 20261025 and two threads. The fitting sample has **84,674 observations**, retaining every fraud and a deterministic hash-selected 10% of negatives with inclusion weights. Histories are calculated before sampling.

Selection uses 2016Q3 bucket 2; calibration uses 2016Q4 bucket 3. Each is built in long and short upload views. The views repeat the same original records and are not independent samples. Training, selection and calibration source rows are disjoint; selection and calibration users are absent from fitting. These are reused synthetic development populations, not fresh external confirmation.

The selected depth-six model keeps the same weights after selection. Its threshold is calibrated once at **-1.8899241882241695**, maximizing worst-view F1 subject to empirical false-positive rate <=0.1% in each calibration view and pooled. Runtime eligibility additionally requires at least ten prior completed purchases, a chip/swipe transaction and no v8 alert. This false-positive budget is a development criterion, not a production guarantee.

**Validation support is weak:** selection has only 17 unique frauds and calibration 19. The selected model finds 1/17 in each selection view. Calibration finds 4/19 with 32 false suggestions on long histories, and 1/19 with 41 false suggestions on short histories. Its calibration precision is only 11.11% and 2.38%, respectively. These results are why the UI calls it an experimental reviewer rather than another reliable fraud classifier.

Direct chip-electronics fraud examples are still absent from the available IBM data inspected in the preceding audit. The implementation has not fabricated such labels or trained on the supplied missed scenarios. The model's modest electronics result is behavioral transfer, not evidence that this training gap is solved.

[Protocol](protocol.json), [both configurations](experiments.json), [frozen reviewer](frozen.json).

## Evaluation after freezing

On the supplied 10,000-row scenario file, v8 remains exactly **73 detections, 398 false alerts, 15.50% precision and 40.56% recall**. The reviewer adds 20 separate suggestions, of which 13 are labeled fraud and seven legitimate.

| Authored fraud pattern | Cases | Additional suggestions on fraud |
| --- | ---: | ---: |
| Counterfeit swipe | 26 | 9 (34.62%) |
| Electronics cash-out | 35 | 4 (11.43%) |
| Other fraud patterns | 119 | 0; online activity is outside reviewer eligibility |

The seven legitimate suggestions comprise five ordinary purchases, one ordinary/travel purchase and one labeled legitimate-travel purchase. No suggestions occur in the supplied legitimate fast-repeat, large-purchase, unfamiliar-online or subscription control groups. These are small author-defined groups, not bank outcomes or guarantees about all purchases of those kinds.

If an analyst investigated both outputs, the union would cover 86/180 scenario frauds with 405 legitimate cases to review. **That union is not the v8 model metric**, and its workload is larger. Neither the research nor UI reclassifies review suggestions as confirmed fraud.

| Reused native IBM evaluation | Frozen v8 TP / FP | Additional reviewer fraud / legitimate |
| --- | ---: | ---: |
| Primary long history, 334,777 rows | 260 / 8 | 0 / 216 |
| Same source rows, short history | 248 / 10 | 0 / 177 |
| Diagnostic long history, 160,321 rows | 124 / 2 | 0 / 71 |
| Same diagnostic rows, short history | 126 / 4 | 0 / 69 |

This reviewer **does not improve the native IBM fraud result**. It supplies some useful investigation candidates in the authored patterns at the cost of additional legitimate reviews elsewhere. It is kept separate and its list starts collapsed. No threshold or weights were changed after these results were inspected.

[Full evaluation and pattern/control counts](evaluation.json).

## Frozen v8 integration and samples

The v8 package copies the already-frozen online specialist and uses the existing hash-checked v7 card package. Its online cutoff stays **1.8637710412616648**; the card cutoff remains **2.485474202331682**. No v8 retraining or threshold adjustment occurred. The prior research decision remains preserved as a historical record; installation reflects the user's later explicit choice, not a claim that its failed broader promotion criteria have now passed.

V8 bundle SHA-256: `da7bfaa47a98c4034f2226d67e25195e478b49b57baba71f4cdbc7ac6846e606`.

Reviewer bundle SHA-256: `34ec3e0351fa2977a1614e58ae2bd727a652d4d988e7528849d4d0b6733e56a2`.

Production v8 matches every frozen native prediction across **990,196 history-view observations**, representing 495,098 distinct source transactions shown in two views. All eight model margins and all decisions on the 10,000-row scenarios are also unchanged by running the reviewer. [Production/native parity receipt](../upload-v8/packaged-native-parity.json).

The six existing IBM CSVs retain their exact bytes and labels. Their catalog now reports live v8 results: 0/0, 6/7, 8/15, 19/19, 96/113 and 107/123 detections, respectively, with zero false alerts in these curated files. Some examples regress relative to v7, consistent with the user's selected policy. Reviewer suggestions are not included in those model counts. [Sample catalog](../../sample-library/upload-v8/catalog.json).

## Verification and reproduction

Validation completed: 332 backend tests in the full run, followed by nine targeted review tests including the newly added retained-record regression (333 unique backend tests covered); 226 frontend unit tests; 33 browser checks including the new reviewer flow and accessibility; strict type checking of 130 backend source files; frontend lint/typecheck/production build; production HTTP smoke. The live local server reports v8. The existing frontend bundle-size advisory remains.

Tests cover label/policy independence, exact frozen prediction parity, prefix causality, minimum-history and channel eligibility, nonmutation of model inputs and outputs, artifact corruption, review-unavailable behavior, unchanged model metrics with suggestions added, retained-result persistence, decoder consistency, historical model compatibility and live sample counts. Test server cleanup required terminating only the verified completed suite server processes on Windows; the suite exited successfully with 33 passes.

Research commands (use the repository Python with `PYTHONPATH=backend`):

```text
-m ml.card_pattern_research prepare
-m ml.card_pattern_research train
scripts/package_upload_v8.py
scripts/package_card_pattern.py
-m ml.card_pattern_evaluate
scripts/verify_v8_native.py
```

Recorded research/package stages refuse to overwrite frozen artifacts. For a new experiment, use a new version rather than rerunning over these outputs. `scripts/refresh_upload_v8_samples.py` refreshes sample model receipts with `PYTHONPATH=backend;.` and rejects an incompatible active engine. No training data is required for runtime inference; packaged v8, v7, v13 and reviewer artifacts are required.
