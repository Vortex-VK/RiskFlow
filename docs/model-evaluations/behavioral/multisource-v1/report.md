# Multi-source training experiment

This is an exploratory experiment on two already exposed synthetic sources. It cannot establish generalization to an arbitrary or unseen dataset. No runtime model was promoted; V13 and the previous experiment remain unchanged.

**Finding:** balanced pooled training did not improve the primary comparison. On Handbook, relative-feature models with history augmentation dropped from 888 to 819 detections at the same 3,178 reviews: 31.44% to 29.00% recall. The difference was -2.44 percentage points, with a paired user-bootstrap interval of [-3.42, -1.40]. On IBM, both detected 0 of 24 fraud cases at 160 reviews. This fails the prespecified exploratory nomination rule: no source gained two points, and Handbook lost more than two points. Pooling is implemented and tested; it is not supported as a runtime upgrade by this experiment.

The useful improvement was history augmentation within a source. Across three seeds, Handbook-only relative models improved one-day-history recall from 6.89% to 9.67%, and scoped-amount models improved it from 23.06% to 26.75%. This is evidence of improved short-history robustness on this benchmark, not unseen-source generalization.

The frozen protocol compares 12 setups with two candidate configurations each and three seeds for the selected configuration. Histories stay within source, account and unit. IBM uses users 0–199, April–September 2018, with whole-user holdout. Handbook retains its original customer holdout. Dates are shared across sources: April warmup; May 1–July 29 fit; July 30–August 13 model selection; August 14–28 threshold calibration; August 29–September 30 evaluation.

Relative features omit the three absolute amount measurements. Scoped features add separate amount columns for each source; they are a known-source diagnostic, not a claim that synthetic currency and USD are interchangeable. Augmentation assigns each fitting event exactly one of full, one-day, seven-day, empty, or date-only history using a deterministic ID hash. It retains all eligible events and the observed class proportions. Pooled training gives sources equal total sample weight. Single-source runs tune only on that source's development labels.

## Equal daily review capacity, full input

Base seed 20261024. Capacity is ceil(1% or 5% of eligible daily transactions), ranked separately for each source. Recall includes unscored fraud as missed. AP is computed on scored records. Fixed-threshold results use separately calibrated, condition-specific thresholds; there is no target-source retuning.

| Training / features / fit | Evaluation | TP / reviews at 1% | Recall at 1% | Recall at 5% | AP | Threshold F1 |
|---|---|---:|---:|---:|---:|---:|
| handbook-relative-full | handbook | 892 / 3178 | 31.59% | 36.37% | 30.10% | 39.95% |
| handbook-relative-full | ibm | 0 / 160 | 0.00% | 0.00% | 0.20% | 0.21% |
| handbook-relative-augmented | handbook | 888 / 3178 | 31.44% | 36.30% | 30.57% | 40.39% |
| handbook-relative-augmented | ibm | 0 / 160 | 0.00% | 0.00% | 0.23% | 0.51% |
| handbook-scoped-full | handbook | 948 / 3178 | 33.57% | 37.29% | 33.76% | 45.29% |
| handbook-scoped-full | ibm | 0 / 160 | 0.00% | 0.00% | 0.20% | 0.16% |
| handbook-scoped-augmented | handbook | 936 / 3178 | 33.14% | 36.69% | 33.50% | 45.31% |
| handbook-scoped-augmented | ibm | 0 / 160 | 0.00% | 4.17% | 0.25% | 0.55% |
| ibm-relative-full | handbook | 51 / 3178 | 1.81% | 11.33% | 1.54% | 0.14% |
| ibm-relative-full | ibm | 0 / 160 | 0.00% | 0.00% | 0.22% | 0.00% |
| ibm-relative-augmented | handbook | 57 / 3178 | 2.02% | 14.98% | 1.62% | 0.00% |
| ibm-relative-augmented | ibm | 0 / 160 | 0.00% | 0.00% | 0.23% | 0.00% |
| ibm-scoped-full | handbook | 46 / 3178 | 1.63% | 8.53% | 1.32% | 0.85% |
| ibm-scoped-full | ibm | 0 / 160 | 0.00% | 4.17% | 0.25% | 0.00% |
| ibm-scoped-augmented | handbook | 50 / 3178 | 1.77% | 12.22% | 1.58% | 0.77% |
| ibm-scoped-augmented | ibm | 0 / 160 | 0.00% | 0.00% | 0.16% | 0.00% |
| pooled-relative-full | handbook | 785 / 3178 | 27.80% | 34.67% | 21.96% | 21.26% |
| pooled-relative-full | ibm | 0 / 160 | 0.00% | 8.33% | 0.20% | 0.00% |
| pooled-relative-augmented | handbook | 819 / 3178 | 29.00% | 35.59% | 24.09% | 26.95% |
| pooled-relative-augmented | ibm | 0 / 160 | 0.00% | 12.50% | 0.25% | 0.00% |
| pooled-scoped-full | handbook | 938 / 3178 | 33.22% | 36.26% | 33.39% | 44.95% |
| pooled-scoped-full | ibm | 0 / 160 | 0.00% | 0.00% | 0.16% | 0.00% |
| pooled-scoped-augmented | handbook | 936 / 3178 | 33.14% | 36.33% | 33.11% | 44.71% |
| pooled-scoped-augmented | ibm | 0 / 160 | 0.00% | 4.17% | 0.12% | 0.00% |

## Prespecified pooling comparison

Pooled relative augmented minus target-source relative augmented, at daily 1% capacity. User intervals use 500 paired whole-user resamples and recompute capacity and selections for every resample. Seven-day circular block intervals provide a time-dependence sensitivity check. Intervals are exploratory.

| Source | Recall difference | User bootstrap 95% interval | Seven-day 95% interval |
|---|---:|---:|---:|
| handbook | -2.44 pp | [-3.42, -1.40] pp | [-3.08, -1.78] pp |
| ibm | +0.00 pp | [+0.00, +0.00] pp | [+0.00, +0.00] pp |

IBM has 15,128 evaluation records, 14,462 eligible records, and only 24 fraud cases across five users. There are just two fraud cases among heldout users. The zero-width difference interval reflects two ineffective rankings on this small observed sample; it is not evidence that the models are equivalent on future data. Three user-bootstrap draws contained no fraud and were excluded, leaving 497 defined draws. Handbook has 316,197 evaluation records, 316,188 eligible records, and 2,824 fraud cases across 1,341 users. Unscored records contain no fraud in these evaluation cohorts.

At the wider 5% capacity, the pooled relative augmented model detects 3 of IBM's 24 fraud cases in 738 reviews (12.50% recall, 0.41% precision), versus zero for the IBM-only counterpart. This secondary result does not rescue the failed primary comparison. All 12 setups and all three seeds detect zero IBM fraud under full input at 1% capacity.

## History degradation and seed stability

Recall at daily 1% capacity, mean and minimum–maximum across three seeds. Cold relative inputs contain no amount or prior behavior, so ties carry no useful behavioral information. ID ordering is only a reproducible tie break.

| Setup | Source | Full | One day | Seven days | Empty | Date only |
|---|---|---:|---:|---:|---:|---:|
| handbook-relative-full | handbook | 31.62% (31.55–31.73) | 6.89% (6.30–8.07) | 25.52% (25.32–25.64) | 0.99% (0.99–0.99) | 31.37% (31.37–31.37) |
| handbook-relative-full | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 2.78% (0.00–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| handbook-relative-augmented | handbook | 31.31% (31.13–31.44) | 9.67% (9.56–9.74) | 27.28% (27.20–27.41) | 0.99% (0.99–0.99) | 31.36% (31.20–31.52) |
| handbook-relative-augmented | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| handbook-scoped-full | handbook | 33.56% (33.53–33.57) | 23.06% (22.80–23.26) | 31.48% (31.44–31.52) | 24.26% (24.22–24.33) | 33.55% (33.46–33.64) |
| handbook-scoped-full | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 4.17% (4.17–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| handbook-scoped-augmented | handbook | 33.09% (32.93–33.18) | 26.75% (26.63–26.84) | 32.26% (32.19–32.37) | 24.23% (24.22–24.26) | 33.11% (33.07–33.18) |
| handbook-scoped-augmented | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| ibm-relative-full | handbook | 2.05% (1.81–2.27) | 2.89% (2.66–3.15) | 1.63% (1.35–1.81) | 0.99% (0.99–0.99) | 2.10% (1.66–2.37) |
| ibm-relative-full | ibm | 0.00% (0.00–0.00) | 1.39% (0.00–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| ibm-relative-augmented | handbook | 1.90% (1.74–2.02) | 3.66% (3.40–4.00) | 1.38% (1.20–1.56) | 0.99% (0.99–0.99) | 1.82% (1.52–1.98) |
| ibm-relative-augmented | ibm | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| ibm-scoped-full | handbook | 1.74% (1.63–1.84) | 3.06% (3.01–3.12) | 1.45% (1.35–1.56) | 0.99% (0.99–0.99) | 1.66% (1.63–1.70) |
| ibm-scoped-full | ibm | 0.00% (0.00–0.00) | 1.39% (0.00–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| ibm-scoped-augmented | handbook | 1.72% (1.66–1.77) | 3.18% (2.62–4.07) | 1.38% (1.31–1.45) | 0.99% (0.99–0.99) | 1.59% (1.49–1.66) |
| ibm-scoped-augmented | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| pooled-relative-full | handbook | 27.77% (27.58–27.94) | 2.68% (2.09–2.97) | 13.85% (13.24–14.80) | 0.99% (0.99–0.99) | 27.87% (27.37–28.29) |
| pooled-relative-full | ibm | 0.00% (0.00–0.00) | 1.39% (0.00–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| pooled-relative-augmented | handbook | 28.92% (28.86–29.00) | 5.72% (5.59–5.84) | 19.02% (18.80–19.30) | 0.99% (0.99–0.99) | 29.37% (29.18–29.75) |
| pooled-relative-augmented | ibm | 0.00% (0.00–0.00) | 4.17% (4.17–4.17) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| pooled-scoped-full | handbook | 33.19% (33.11–33.25) | 19.29% (18.84–19.90) | 31.40% (31.37–31.44) | 23.12% (23.05–23.16) | 33.16% (32.97–33.32) |
| pooled-scoped-full | ibm | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |
| pooled-scoped-augmented | handbook | 33.05% (33.00–33.14) | 26.51% (26.49–26.56) | 31.88% (31.80–31.94) | 24.24% (24.22–24.29) | 32.83% (32.79–32.86) |
| pooled-scoped-augmented | ibm | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) | 0.00% (0.00–0.00) |

## Development label support

| Source | Role | Eligible rows | Fraud | Users |
|---|---|---:|---:|---:|
| handbook | fit | 690514 | 5934 | 3999 |
| handbook | selection | 115497 | 1034 | 3944 |
| handbook | threshold | 115316 | 1016 | 3951 |
| ibm | fit | 31201 | 47 | 113 |
| ibm | selection | 5198 | 0 | 113 |
| ibm | threshold | 5297 | 0 | 113 |

IBM selection and threshold blocks contain no fraud. IBM-only candidate objectives tie at zero, so the prespecified first configuration wins. Its threshold is placed above the largest calibration score and has no evidence of fraud sensitivity. Pooled selection also receives no positive-case information from IBM in that block. These limitations weaken conclusions about training-source choice; the split was not moved after observing them.

## Reproduction and limits

Run from the repository root with `PYTHONPATH=backend` using the backend virtual environment: `python -m ml.behavioral.multisource freeze`, `extract`, then `prepare --source SOURCE --condition CONDITION` for both sources and five conditions, followed by `run`. Existing completed artifacts are immutable; use a new experiment version for a new protocol.

`protocol.json` records the frozen choices and source references. `results.json` contains all 360 evaluations, source fitting counts, selected configurations, threshold metrics, user subgroups, scenario breakdowns, code hashes, and memory measurements. `prediction-freeze.json` binds all predictions before label joining. Local Parquet predictions and models are under `training_data/ml-general/multisource-v1`. Subgroup budget results rerank within each subgroup; they do not partition the whole-population review queue.

The evaluation cohorts were used in earlier diagnostics. Selection never uses evaluation labels in this pipeline, but the research design itself was informed by prior failures. IBM's small exposed cohort can yield wide intervals and few fraud cases. Two synthetic generators do not represent arbitrary real-world transactions. Fresh source-level confirmation remains necessary.

## Recommended next experiment

1. **Fix development label support first.** Define a broader IBM development cohort and longer selection/calibration windows in a new protocol, preserving a separate confirmation cohort. Establish a minimum fraud-support requirement before fitting; treat unsupported calibration as unavailable. The current 47 fitting fraud cases and zero selection/calibration positives cannot support a useful search for IBM sensitivity. Do not move this experiment's boundaries or reuse its final outcomes to select a replacement model.
2. **Keep short-history augmentation and test controlled source weighting.** Augmentation improved the one-day benchmark without adding records. Equal source weighting hurt the relative model on Handbook. With adequate development labels from both sources, compare a small declared set of source weights against separate specialists, selecting on per-source review-budget recall with a worst-source constraint. Do not select weights from these evaluation results.
3. **Retain a portable relative core; use amount specialists only for known units.** Scoped amounts preserve about 33% Handbook recall but still miss all IBM fraud at the primary budget. Their strong empty-history Handbook result is consistent with useful amount information in that generator, not portable behavioral knowledge. A specialist or routing approach needs its own evaluation; raw margins from different models must not be treated as comparable probabilities.
4. **Measure unseen-source performance explicitly.** Obtain another compatible source with authoritative account identity, time, amount units and fraud outcomes. Hold the entire source out from feature choices, fitting, model selection and threshold calibration. With more sources, use leave-one-source-out development checks, then one untouched confirmation source. More records from the same two generators would not establish this property.
5. **Respect missing evidence.** Relative cold-start inputs contain no discriminating behavior; their 0.99% Handbook recall comes from the deterministic tie break. Keep descriptive output or an explicitly supported amount-only specialist when history is absent. Merchant-compromise detection may need additional observable evidence, such as legitimately available delayed confirmations; any such feature requires causal availability checks and a new experiment.

These are proposed research steps, not changes applied to the live engine. The immediate implementation result is a reproducible source-balanced experiment and evidence against promoting this pooled model.

## Verification

- 231 backend tests passed, including 10 new tests for source isolation, history degradation, scale invariance, augmentation, target guards, thresholds, ranking budgets and bootstrap replication.
- Backend Ruff checks passed; the new package and tests pass formatting checks. Strict mypy passed across 82 backend source files.
- The [independent numerical audit](numerical-audit.json) verified all 360 prediction files, identical evaluation populations across conditions and models, equal source fitting weight, preserved fitting counts, and the primary daily review totals using a separate pandas implementation.
- All 48 candidate/stability fits completed. Maximum recorded training-process peak memory was 0.884 GiB, below the declared 2.5 GiB limit. Models use two training threads.
- V13 manifest SHA-256 remains `62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046`. Runtime inference and frontend behavior were not modified in this follow-up.
