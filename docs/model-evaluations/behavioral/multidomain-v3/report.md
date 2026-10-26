# Three-domain training and a fresh BankSim test

The new account-history model improves the supplied 10,000-row diagnostic from **8 to 23 detected fraud cases** at the same daily 1% review capacity, and from **24 to 80** at 5%. It also improves Sparkov after Sparkov becomes a training domain. However, it loses substantial IBM performance and does not establish reliable generalization. The new models remain offline; V13 is unchanged.

This experiment completed 18 fits and 238 final model/condition/seed comparisons. Model selection used whole-source holdouts across Handbook, IBM, and Sparkov. BankSim was reserved until every final prediction was frozen. The selected policy uses account history only: the merchant expert and rank combinations did not win source-holdout selection. Their later BankSim results are diagnostics, not a reason to change the nominated model retrospectively.

## Detection at the same workload

These are fraud recall percentages, not classification accuracy or fraud probabilities. Each day permits `ceil(0.01 × eligible transactions)` reviews. All fraud remains in the denominator, including unscored fraud. Scores rank transactions, with transaction ID breaking ties. Base seed: 20261024.

| Evaluation population | Fraud | Reviews | Previous core | Previous rich | Selected account | New merchant, diagnostic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Handbook, September | 2,547 | 2,893 | 29.21% | 32.63% | 28.90% | 30.59% |
| IBM, September | 262 | 1,364 | 1.15% | 20.23% | 6.11% | 7.25% |
| Sparkov, March 22–31 | 149 | 239 | 18.79% | 13.42% | 48.32% | 63.76% |
| BankSim, steps 30–179 | 6,000 | 5,215 | 12.40%* | 27.33%* | 17.62% | 29.33% |
| Supplied 10,000 rows | 180 | 181 | 3.89% | 4.44% | 12.78% | 10.56% |

The previous models are the frozen `robust-v2` core-balanced and rich-balanced models, rescored on identical rows. *Their BankSim results are unsupported date-only stress tests: those models were not trained on the new date-only feature path. They are not evidence of supported BankSim deployment.

Sparkov's comparison uses only March 22–31, not the February–March period in the previous report. Its earlier labels now enter training and selection. The increased Sparkov result therefore measures performance within a represented domain, not transfer to an unseen source. The final window is only ten days and contains 16 fraud-bearing users.

On the supplied upload, the selected model detects 23/180 fraud cases at 181 reviews, versus 8/180 for previous rich. At the daily 5% budget it detects 80/180 (44.44%) at 585 reviews, versus 24/180 (13.33%). Daily rounding makes those actual review volumes 1.81% and 5.85% of the entire upload. At the smaller budget, only 12.71% of selected reviews contain fraud; most fraud is still missed. This is a useful improvement, not sufficient general accuracy.

On fresh BankSim, the selected model detects 1,057/6,000 fraud cases with 20.27% review precision. The nonselected merchant model detects 1,760/6,000. Choosing merchant after seeing this result would consume the test for model selection, so no such change was made.

## Stability and uncertainty

Three independent estimator seeds used the same fitting population and selected configurations. No seed was selected using final results.

| Population | Selected model mean recall | Three-seed range |
| --- | ---: | ---: |
| Handbook | 29.18% | 28.90–29.60% |
| IBM | 5.22% | 4.58–6.11% |
| Sparkov | 47.20% | 46.31–48.32% |
| BankSim | 15.90% | 14.37–17.62% |
| Supplied upload | 13.33% | 12.78–14.44% |

The following are selected-model minus previous-rich recall differences, in percentage points. These reference comparisons are exploratory. They use 500 paired whole-user resamples with daily capacity and ordering recomputed, plus a seven-day block sensitivity analysis. The block interval is especially limited by Sparkov's short final window. These intervals do not measure uncertainty about other institutions or real-world data.

| Population | Observed difference | User 95% interval | Seven-day 95% interval |
| --- | ---: | ---: | ---: |
| Handbook | −3.73 | [−4.52, −2.83] | [−4.52, −2.94] |
| IBM | −14.12 | [−20.65, −9.00] | [−18.39, −10.29] |
| Sparkov | +34.90 | [+22.44, +46.10] | [+25.52, +51.52] |
| BankSim* | −9.72 | [−11.04, −8.29] | [−11.08, −8.42] |
| Supplied upload | +8.33 | [+3.59, +8.49] | [+4.67, +12.58] |

Mixture-policy bootstrap code recalculates weighted percentile ranks under user replication, rather than treating a combined score as independent of the competing population. The selected account-only policy has invariant within-day ordering, allowing the equivalent faster fixed-order calculation. A test compares weighted ranks and queues against explicitly duplicated records.

## What was implemented

- A shared `DailyContextState` that accepts complete date-only batches, uses only prior days, and masks ambiguous subday and last-amount features. It rejects mixed clocks, delayed observations, and split or decreasing day batches. The previous context engine remains unchanged.
- Separate 18-feature account and 30-feature merchant experts. Both exclude raw identities, source labels, absolute amount levels, demographics, category, channel, outcomes, and generator scenarios as predictors. Merchant identifiers only establish source-local historical relationships.
- Equal total fitting weight per source, retaining all eligible negatives and natural within-source fraud prevalence. Each event appears once, assigned deterministically to full, one-day, cold, missing-context, or date-only history. Full history occupies two of six hash buckets; other variants occupy one each.
- Three leave-one-source-out folds, two CatBoost configurations per expert, five fixed daily rank policies, three final seeds, source and artifact hashes, target-access guards, and independent numerical verification.
- Rank-only outputs throughout this experiment. No source calibrator or global threshold is presented as a probability for arbitrary uploads.

The final account model is independent of optional merchant/category/channel availability. That removes one failure mode, but also discards useful signals in IBM. It is not a universally better feature contract.

## Training and model selection

Handbook and IBM preserve the earlier chronological stages and whole-user holdout assignment: April warmup; May 1–June 23 fitting; July 1–24 selection; September final. August labels are not used here. Sparkov uses January warmup, February 1–21 fitting, March 1–14 selection, and March 22–31 final. There are seven-day gaps between labeled stages. Label maturity remains a simulation assumption, not verified operational latency.

| Source | Fitting rows | Fitting fraud / fraud users | Selection rows | Selection fraud / fraud users |
| --- | ---: | ---: | ---: | ---: |
| Handbook | 414,422 | 3,555 / 1,431 | 183,781 | 1,575 / 764 |
| IBM | 193,542 | 258 / 33 | 86,390 | 88 / 19 |
| Sparkov | 28,179 | 250 / 26 | 24,567 | 170 / 17 |

All fitting and selection populations pass the frozen support minimums. Accounts assigned to the held-out user group do not contribute fitting or selection labels. Earlier unlabeled activity can update inference history, including shared merchant aggregates; this is not a merchant-disjoint claim.

For each fold, the target source contributes no fitting labels. Its nonheldout selection period is used to compare models trained on the other two sources. The objective maximizes the minimum source mean recall across full, one-day, missing-context, and date-only conditions; mean average precision breaks ties. These folds are development evidence, because their labels select the policy.

Both experts selected depth 4 and 250 iterations over depth 6 and 400 iterations. All fits use learning rate 0.06, L2 10, two threads, and the predeclared seeds. Configurations are chosen on raw expert scores, followed by policy selection on daily percentile midranks.

| Rank policy | Worst-source mean selection recall |
| --- | ---: |
| Account, selected | 2.27% |
| Merchant with account fallback for missing merchants | 1.42% |
| 75% account + 25% merchant | 2.27% |
| Equal mixture | 1.99% |
| Maximum expert rank | 1.14% |

Account wins the tie with the 75/25 mixture on mean average precision. IBM is the weakest excluded source. With full history and IBM excluded from training, selected account detects only 3.41% of selection fraud; the merchant expert detects 1.14%. The weak transfer signal was visible before BankSim outcomes were opened.

## Missing and short histories

| Source | Selected full | One-day history | All optional fields missing | Date-only |
| --- | ---: | ---: | ---: | ---: |
| Handbook | 28.90% | 2.24% | 28.90% | 29.56% |
| IBM | 6.11% | 1.53% | 6.11% | 6.11% |
| Sparkov | 48.32% | 4.70% | 48.32% | 42.28% |

Short histories remain a major weakness despite augmentation. Identical full and missing-context results follow from the selected expert's account-only features; they do not mean the merchant expert is immune to missing data.

Eligibility remains explicit. Handbook scores 287,864/287,873 records, IBM 134,705/141,557, Sparkov all 23,598, BankSim 514,116/514,164, and the upload all 10,000. The 11 unscored IBM fraud records remain misses in every end-to-end recall denominator. Unsupported or nonpositive amounts do not update purchase history.

## Fresh-source provenance and decision

BankSim version 1 comes from publisher `ealaxi/banksim1`, with archive SHA256 `3bfd0c2bfbdec83ad36eed499eaf38c6951c36be864ecbe30f3bcb7d84895f66`. Only `bs140513_032310.csv` is parsed. The author paper defines a simulation step as a day, so no intraday timestamps were invented. Steps 0–29 provide unlabeled warmup; steps 30–179 provide 514,164 final records with 6,000 fraud cases across 1,446 fraud-bearing users. Publisher aggregate counts were known before freezing; row-level outcomes were not opened until all final predictions were frozen.

Attribution: Edgar Alonso Lopez-Rojas and Stefan Axelsson, *BankSim: A Bank Payments Simulator for Fraud Detection Research* (2014). The publisher lists **CC BY-NC-SA 4.0**. This is local noncommercial research; raw data is not redistributed. See the [author paper](https://www.msc-les.org/proceedings/emss/2014/EMSS2014_144.pdf) and [publisher dataset](https://www.kaggle.com/datasets/ealaxi/banksim1). Whole-source evaluation is also motivated by [WILDS](https://proceedings.mlr.press/v139/koh21a.html).

The primary gate was a nominated policy improvement over the new account baseline: at least two recall points on BankSim, positive paired-user interval, at least 10% BankSim recall, adequate fraud support, and no greater than two-point loss on any known source versus account. Since account itself won nomination, gain and interval gates fail with zero differences. Support and minimum recall pass. Known-source nonregression versus account passes by identity; it does **not** imply nonregression versus previous rich. The large IBM and Handbook regressions independently rule out a general replacement.

No runtime model was promoted. V13 manifest SHA256 remains `62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046`. BankSim is now consumed evaluation evidence. Handbook, IBM, Sparkov January–March, and the supplied upload are previously exposed data. Other Sparkov `fraudTrain.csv` periods are not claimed pristine because earlier parsing scanned them; `fraudTest.csv` remains unopened.

## What is most likely to help next

The results do not support treating more pooled synthetic rows or a larger model as the main remedy. The selected shallower model won, IBM remained weak when its source was excluded, and training on Sparkov greatly improved Sparkov without fixing IBM. Adding representative labeled domains matters, but coverage of fraud mechanisms and input conditions matters more than dataset count alone.

The next useful model experiment is to retain optional category/channel context as a separate expert and compare source-balanced versus source-and-label-balanced objectives. That tests whether IBM's loss comes from removing useful signals, diluted fraud supervision, or both. It must include the account-only branch and the old rich model on identical populations. The present experiment changes training coverage, features, and augmentation together, so it cannot attribute the upload gain to any one change.

Any further work using BankSim should explicitly treat it as development. Confirmation needs another reserved source, preferably representative labeled transaction exports from the intended operating setting. Longer time-separated windows, whole-institution holdouts, and adequate fraud-bearing-user support would strengthen the evidence. Calibration belongs to an evaluated input domain; unsupported or short-history inputs should retain descriptive observations rather than receive confident fraud probabilities. These are next experiments, not implemented or proven improvements.

## Reproduction and checks

Run from the repository root with `PYTHONPATH=backend` and `backend/.venv/Scripts/python.exe -m ml.behavioral.multidomain`. The stages are `freeze`, `fetch`, `prepare <source>`, `cache <development-source>`, `cv <account|merchant> <0|1>`, `nominate`, `fit <account|merchant>`, `predict`, `evaluate`, and `audit`. Preparation uses all four sources; fitting caches use only the three development sources. Existing frozen output directories deliberately reject overwriting. A new study requires a separately versioned protocol and outputs.

Existing full/one-day feature caches are hash-verified and reused. New date-only caches are separate. Complete development-stage snapshots allowed training while later unlabeled features were still computing; the audit verifies that their hashes match the completed caches. No split boundaries or populations were adjusted.

Validation: **252 backend tests pass**, including eight new tests covering temporal isolation, same-day ordering, scale invariance, missing scores, weighted rank replication, source weights, split boundaries, and final-label access. Ruff passes across application, ML, and tests; strict mypy passes across 101 application/ML source files. Independent queue construction verifies **all 238** reported 1% comparisons and prediction coverage. Peak fitting process memory was 1.236 GiB, below the 2.5 GiB limit; each estimator uses two threads.

Artifacts: [protocol](protocol.json), [execution record](execution-lock.json), [nomination](nomination.json), [prediction freeze](prediction-freeze.json), [all results and intervals](results.json), [independent numerical audit](numerical-audit.json), and [validation](validation.json). Local model and prediction artifacts are under `training_data/ml-general/multidomain-v3/`. Protected historical plans and evaluation results remain unchanged.
