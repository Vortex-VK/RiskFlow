# Frozen candidate: cross-dataset evaluation

The authored-adaptation candidate is strong on the heldout customers from its authored generator and on the main IBM population, but it does not transfer reliably to every tested source. IEEE-CIS cannot directly evaluate this model's input contract. The existing IEEE-specific model was reproduced separately, without attributing its results to the candidate.

**No model was retrained, no threshold was tuned, and the app engine was not changed.** The candidate remains offline. This report uses its frozen probabilities at the user's 90% mark and also records the already-selected card/online policy. It does not select a new policy from these results.

## IBM and labeled authored data: same candidate and V8

Every row below compares both models on identical transactions at **probability >=90%**.

| Population | Rows / frauds | V8 detected / false alerts | Candidate detected / false alerts | Candidate precision / recall |
| --- | ---: | ---: | ---: | ---: |
| IBM primary, wide histories | 334,777 / 263 | 256 / 6 | **257 / 19** | 93.12% / 97.72% |
| Same IBM transactions, short histories | 334,777 / 263 | 244 / 7 | **258 / 23** | 91.81% / 98.10% |
| IBM diagnostic, wide histories | 160,321 / 132 | 119 / 2 | 126 / 7 | 94.74% / 95.45% |
| Same diagnostic transactions, short histories | 160,321 / 132 | 120 / 2 | 125 / 8 | 93.98% / 94.70% |
| Older IBM online, 2018 calibration diagnostic | 22,267 / 10 | 6 / 0 | 4 / 2 | 66.67% / 40.00% |
| Older IBM online, 2018 extension diagnostic | 9,805 / 36 | 20 / 0 | **10 / 0** | 100.00% / 27.78% |
| Authored customer holdout | 1,935 / 30 | 7 / 54 | **26 / 1** | **96.30% / 86.67%** |

The authored holdout contains 19 customers excluded from classifier fitting and probability/policy selection. The other 8,065 transactions from that authored file are deliberately excluded from accuracy claims. Those 19 customers still share the original generator's patterns; this is not independent-generator validation.

IBM wide/short entries are alternate history views of the same records, not independent datasets. All these sources were exposed in earlier work. Their frozen prediction hashes were checked, confusion counts and probability metrics independently recomputed, and the saved candidate head was rerun on the authored holdout with exact probability equality. We did not claim that recounting them created fresh holdouts.

Main IBM precision is lower than V8's 97.71%, and older online recall regresses substantially. The earlier replacement rejection therefore stands.

## IEEE-CIS: direct candidate test is not valid

The provided IEEE transaction and identity files were hashed and their actual headers inspected. They contain transaction amount, relative time, anonymized card/address/identity fields and provider features. They do not establish the authoritative account and merchant identities, MCC, chip/swipe/online channel, completion history and absolute-calendar semantics required by the candidate's existing feature builders.

Treating `card1` or a card-field combination as a confirmed customer, assigning a payment channel or converting anonymous features into MCC/history would change the problem. **Candidate precision/recall on IEEE is therefore not applicable, not zero and not measured.** A valid IEEE model needs a separately trained feature pipeline. This evaluation does not imply that such a pipeline already exists for the candidate.

For a useful separate reference, the already-trained **IEEE-v1 CatBoost full6, seed 20261024** was reloaded and scored on its original chronological final population. Raw scores and calibrated probabilities match its frozen prediction file. Neither the classifier nor the calibration was fitted again.

| Separate IEEE model, 40,641 rows / 1,596 frauds | Detected | False alerts | Precision | Recall |
| --- | ---: | ---: | ---: | ---: |
| Probability >=90% | **203** | **20** | **91.03%** | **12.72%** |
| Its previously selected cutoff, approximately 18.02% | 748 | 572 | 56.67% | 46.87% |

The IEEE model's probability RMSE is 16.03 points, Brier loss 0.025693, log loss 0.106759, average precision 0.5061 and ROC AUC 0.8814. This is a different model on a different population; the table does not benchmark the new candidate against IEEE. It illustrates why a common 90% highlight cannot guarantee a common fraud-capture rate.

## Additional source: Sparkov sensitivity test

The new candidate was freshly scored on the first 100,000 rows of the locally available Sparkov `fraudTrain.csv`, containing 990 labeled frauds across 922 accounts. These rows were not used to fit the new candidate. They were used by prior research, so they are a new test of this head rather than a newly acquired source.

Sparkov supplies account/merchant identity, timestamps and amounts, but lacks the candidate's native MCC, exact payment channel, completion and merchant geography contract. We preserved the three already-documented sensitivity mappings: assume all-chip, all-swipe or all-online; MCC 0000; missing merchant geography; completed=true; naive time treated as UTC; original nominal amounts. Features reset for each 10,000-row upload. All three conditions were frozen before outcomes were extracted; no preferred channel was selected afterward.

| Assumed channel, same 100,000 rows | V8 detected / false alerts at 90% | Candidate detected / false alerts at 90% | Candidate precision / recall |
| --- | ---: | ---: | ---: |
| Chip | 0 / 0 | **0 / 0** | Undefined / 0% |
| Swipe | 0 / 0 | **0 / 0** | Undefined / 0% |
| Online | 2 / 2,766 | **29 / 288** | **9.15% / 2.93%** |

The original candidate policy also finds no chip/swipe fraud. Its higher online cutoff finds 10 frauds with 33 false alerts. Neither policy succeeds here. The three rows share all source records and cannot be pooled as 300,000 independent observations.

Card-view average precision improves to 0.412–0.419, compared with V8's 0.014–0.015, but the scores still remain below the high-probability threshold. This ranking improvement does not establish calibrated probabilities. Missing input semantics prevent interpreting this as a native, fully compatible Sparkov benchmark; it is evidence that these mappings do not support dependable high-threshold detection.

## Additional authored file without fraud labels

The existing generated-2400 source supplies 1,615 eligible purchases from 70 accounts. Its four preserved variants change assumed POS technology and merchant grouping. None was used for this candidate's training.

| Existing variant | Candidate 90%+ estimates | V8 90%+ estimates |
| --- | ---: | ---: |
| Chip, merchant branch grouping | 5 | 27 |
| Chip, merchant brand grouping | 2 | 22 |
| Swipe, merchant branch grouping | 5 | 27 |
| Swipe, merchant brand grouping | 2 | 22 |

There are no confirmed fraud labels. These are workloads, not true/false alert counts or accuracy measurements. Fewer alerts might represent fewer false positives, more missed fraud, or both. The variants share transactions.

The first adapter attempt stopped before inference because source timestamps omitted the millisecond formatting required by the app schema. Canonical UTC millisecond formatting preserves the same instants. The original evaluator and protocol are archived alongside this report; no row, label, model or threshold changed.

## Recommendation and verification

Keep the candidate's claim narrow: improved performance on this authored generator with strong but somewhat lower-precision primary IBM results. It is not yet a universal fraud scorer. Broader deployment requires representative development data and genuinely new compatible evaluation sources, particularly older-online patterns. IEEE requires its own input pipeline; an unsupported mapping should not be presented as candidate accuracy.

The audit independently verified 32 metric rows and four unlabeled variants, including prediction hashes, confusion matrices, bounded probabilities, Brier loss, RMSE, log loss, AP and ROC AUC. Source-specific IEEE model and probability replay matched the stored outputs. Both new scripts pass backend Ruff rules. Existing runtime packages are unchanged; no app code was modified during this evaluation.

Artifacts: [machine-readable comparison CSV](comparison.csv), [protocol](protocol.json), [IBM/authored results](native-authored.json), [IEEE compatibility and separate model](ieee.json), [Sparkov](sparkov.json), [unlabeled authored results](authored-unlabeled.json), [audit receipt](verification.json). Reproduction: [evaluator](../../../scripts/evaluate_candidate_datasets.py), [audit](../../../scripts/audit_candidate_datasets.py). Original training and gates: [candidate report](../authored-adaptation-v3/report.md).
