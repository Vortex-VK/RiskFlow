# Card specialist improvement: preserve coverage, prioritize stronger leads

The installed `card-pattern-v5` package preserves every `card-pattern-v1` review suggestion and adds a separately trained priority model. Upload-v8 weights, thresholds, alerts and fraud metrics remain frozen. This improves review ordering, **not total fraud detection or total false-positive counts**.

The stricter candidate was not installed as a replacement: it reduced legitimate suggestions sharply, but lost more than half the authored fraud suggestions. Two other filtering approaches also failed their gates. Their results remain recorded; no failed gate was rewritten as a pass.

## Delivered behavior

Results lists **Prioritized card reviews** first, followed by **Exploratory card leads**. Both groups remain visible and retain their own labeled outcome counts when labels are available. The overall review count still includes both groups. Payment details show both raw margins, version identities, and an explicit explanation that priority is not a fraud probability. Saved assessments preserve this evidence. Historical v1 assessments remain readable.

Try **Samples → Open card-review demo → Simulate → Results → Experimental card reviews**. The same 186-row CSV now shows two prioritized fraud cases, followed by one fraud case and one legitimate purchase as exploratory leads. The CSV and its labels were not changed. The six original IBM CSVs and their v8 metrics also remain unchanged.

## Measured results

| Evaluation | All original leads: fraud / legitimate | Prioritized: fraud / legitimate | Exploratory: fraud / legitimate |
| --- | ---: | ---: | ---: |
| Authored scenarios, 10,000 transactions | 13 / 7 | **6 / 0** | 7 / 7 |
| Primary IBM, long history, 334,777 transactions | 0 / 216 | **0 / 0** | 0 / 216 |
| Same primary rows, short history | 0 / 177 | 0 / 0 | 0 / 177 |
| Diagnostic IBM, long history, 160,321 transactions | 0 / 71 | 0 / 0 | 0 / 71 |
| Same diagnostic rows, short history | 0 / 69 | 0 / 0 | 0 / 69 |
| Curated authored demo, 186 transactions | 3 / 1 | 2 / 0 | 1 / 1 |

The six prioritized scenario frauds comprise **four counterfeit-swipe and two electronics cash-out cases**. Overall card-pattern coverage stays nine of 26 counterfeit-swipe cases and four of 35 electronics cash-out cases. Seven additional frauds are still in the exploratory group: ignoring that group sacrifices recall.

The primary IBM result still contains **216 false suggestions**. None is prioritized; they have not disappeared. No extra native fraud is found. V8 still produces its original model results independently, including 260 true alerts and eight false alerts on the primary long-history evaluation.

[Full priority/coverage evaluation](evaluation.json), [installation decision](decision.json).

## What was tried

1. **V2 replacement:** five new CatBoost configurations plus the old model with a stricter cutoff. Tested broader data, hard-negative weighting, payment channel, geographic familiarity, merchant context, and tree depth. Selection favored the relative-behavior model. As a replacement it yielded six scenario frauds / zero legitimate suggestions and three primary IBM false suggestions, versus v1's 13 / seven and 216. It failed the predeclared coverage-preservation gate. [Protocol](../card-pattern-v2/protocol.json), [experiments](../card-pattern-v2/experiments.json), [frozen candidate](../card-pattern-v2/frozen.json), [evaluation](../card-pattern-v2/evaluation.json).
2. **V3 learned confirmation:** selected a second model to filter v1 proposals, using development data only. It yielded zero scenario fraud suggestions and failed the regression gate. It also failed to retain the historical short-view calibration fraud. Not installed. [Protocol](../card-pattern-v3/protocol.json), [evaluation](../card-pattern-v3/evaluation.json).
3. **V4 observable corroboration:** compared 54 amount/cadence filters on selection data. The selected filter failed the separate calibration retention requirement. It was rejected without evaluating scenarios or final data. [Protocol](../card-pattern-v4/protocol.json), [calibration rejection](../card-pattern-v4/frozen.json).
4. **V5 prioritization:** retain frozen v1 leads and use the frozen v2 model/cutoff only to prioritize their intersection. No retraining or new threshold selection. Its role was chosen after viewing the exposed regression results; this is an adaptive engineering choice, not an independently validated promotion of fraud accuracy.

The v2 training pool has **1,418,140 distinct card transactions and 1,151 frauds**, comprising 844,082 older transactions / 315 frauds and 574,058 newer transactions / 836 frauds. Newer transactions appear in both wide and short history views, and must not be counted twice as independent evidence. The fitting sample has 220,147 view observations. All fitting frauds and hard negatives were retained, with deterministic sampling and inclusion weights for the remaining legitimate transactions. Histories were built before sampling.

The selected priority model uses 37 relative-behavior/channel features, 400 trees, depth six, learning rate 0.06, L2 15, seed 20261025, and a frozen margin cutoff of **-1.0691764979048273**. It excludes absolute geography, raw MCC, identity predictors, absolute amount and fraud feedback. Geographic and broader merchant-context alternatives were tested but were not selected.

Selection and calibration combine the historical and more recent IBM periods, in long and short views. Fit users are absent from both; source rows are disjoint. Some selection and calibration customers occur in different periods. This is mixed-era development on reused synthetic data, not a globally chronological or external validation experiment. Only 17 and 19 unique frauds support the historical selection and calibration cohorts.

V2 calibration has 2 true / 1 false suggestion on historical wide views, 1 true / 0 false on historical short views, 1 true / 1 false on recent wide views, and no suggestions on recent short views. These tiny counts cannot establish reliable precision. The observed six-of-six prioritized scenario result likewise does not establish universal 100% precision.

## Reproducibility and checks

V5 bundle SHA-256: `47db3ad7245bcb988d3ea22b575771b9a5bd8536eec1a96c9af71386b0195b97`.

The package depends on the unchanged v1 reviewer and stores the hash-checked v2 priority weights. V8's bundle remains `da7bfaa47a98c4034f2226d67e25195e478b49b57baba71f4cdbc7ac6846e606`. Tests verify that v1 lead flags and margins are identical, priority is a subset of leads, prior-history causality is preserved, retained evidence survives reopening, and artifact mismatches fail explicitly. The priority evaluation reproduces unchanged leads over all four native history views and unchanged v8 margins on scenarios and the demo.

Validation: **339 backend tests, 227 frontend tests, four browser checks including accessibility, strict type checking of 136 backend files, frontend type checking/build, and lint**. Browser checks cover the two review groups, outcome counts, details, model invariance and retained model results. Windows test-server cleanup stopped only verified descendants after all four cases completed; the runner exited successfully.

Use `PYTHONPATH=backend` with the repository Python:

```text
-m ml.card_pattern_refinement prepare
-m ml.card_pattern_refinement train
-m ml.card_pattern_compare
-m ml.card_pattern_confirmation
-m ml.card_pattern_compare --confirmation
-m ml.card_pattern_corroboration
scripts/package_card_priority.py
-m ml.card_priority_evaluate
```

Versioned preparation, frozen evaluation and packaging refuse to overwrite existing artifacts. Original v1 research/runtime and v8 bundles remain unchanged. A nonnumerical typing/formatting correction during v2 training is recorded in its protocol, with the original source and protocol preserved. For a new experiment use a new version.
