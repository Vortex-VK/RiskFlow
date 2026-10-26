# Authored adaptation v2: selection only, not installed

This revision of [v1](../authored-adaptation-v1/report.md) retains its customer split and two-percentage-point IBM preservation constraint. No reserved test predictions were accessed during this study.

Four classifiers were trained. Three learn corrections to V8's existing log-odds. The fourth learns from broader transaction context without that offset. The latter three give IBM four times the authored source weight in fitting. Probability calibration uses an equal-source selection mixture. No positive-class balancing is applied.

| Candidate | Authored selection TP / 38 | FP / 2,067 | Shared cutoff | IBM constraint |
| --- | ---: | ---: | ---: | --- |
| Residual, equal sources | 29 | 0 | 81.04% | Failed |
| Residual, greater IBM weight | 28 | 0 | 72.63% | Failed |
| Context, greater IBM weight | 27 | 0 | 95.98% | Failed narrowly |
| Shallow residual, greater IBM weight | 25 | 1 | 78.69% | Failed |

The frozen selection rule chooses `context_preserve`, the smallest constraint violation. It misses two additional frauds out of 92 on the wide IBM selection cohort: a 2.17-point recall decline against a two-point limit. This selected model is not an additive residual model.

None passes with a shared cutoff. V3 tests the already-selected model with separate card and online cutoffs, matching V8's policy structure. It does not refit or select another model. V2 has no reserved evaluation of its own.

Evidence: [protocol](protocol.json), [experiments](experiments.json), [frozen selection](frozen.json). Training: [script](../../../scripts/train_authored_residual.py).
