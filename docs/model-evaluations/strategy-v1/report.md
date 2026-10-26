# Strategy revision and V13 audit

RiskFlow now treats benchmark classification, descriptive transaction analysis, and graph investigation as separate capabilities. Public IEEE-CIS data can support a useful portfolio benchmark without access to private bank records. That benchmark cannot establish fraud-detection accuracy for arbitrary transaction exports.

The supplied proposal is directionally sound, with two corrections. Column compatibility is a necessary input check, not evidence that a model is valid for an upload's source. Also, the quoted approximately 97% precision / 73% recall is not the latest frozen V13 result. Different historical periods and policies must not be combined into one headline result.

## Audit findings

The audit replays the four retained V13 evaluation artifacts, reproduces their component scores and independent policy calculations, verifies model and prediction hashes, and checks available fitting populations. Packaged runtime outputs also match the full reference exactly. It does not change model weights, cutoffs, saved assessments, or historical reports.

| Saved population | Rows | Fraud | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2016Q4 | 50,944 | 82 | 63 | 4 | 19 | 50,858 | 94.03% | 76.83% |
| 2018Q3 | 51,987 | 64 | 49 | 2 | 15 | 51,921 | 96.08% | 76.56% |
| 2018Q4 pilot | 51,889 | 110 | 81 | 1 | 29 | 51,778 | 98.78% | 73.64% |
| Latest full reference | 51,889 | 110 | 87 | 1 | 23 | 51,778 | 98.86% | 79.09% |

The latest pilot and full reference contain the same 51,889 transaction IDs. They are not independent test cohorts. The latest full prevalence is approximately 0.212%; its high precision reflects 87 true detections and a single observed false alert.

Historical protocols explicitly describe adaptive reuse of consumed synthetic IBM history. Thresholds were selected on their calibration tables, but repeated model development used evaluation results. Chronological ordering does not undo that selection exposure. V13's protocol also says its multiple-comparison intervals do not correct all historical adaptive tuning. These results reproduce; they are not independent evidence of real-world or arbitrary-upload accuracy.

There is a material audit limitation: earlier cleanup retired the original raw-to-feature builders and some later base-model fitting tables. The 2016 specialist fitting population remains available and is verified against saved IDs, labels, weights and parameters. Available fitting users are disjoint from evaluation users, and fitting precedes calibration and evaluation. For missing later base-fitting tables, the audit reports declared dates and **null** verification fields instead of asserting that their actual training populations were checked. This is not a complete raw-source leakage certification.

The retained feature implementations compute equal-time observations before updating history. Delayed merchant feedback uses strict prior cutoffs; the historical v8 protocol assumes a 30-day reporting delay and fit-role labels only. Such a delay is an experimental assumption, not verified IBM adjudication metadata. Runtime uploads have no confirmed merchant-fraud feedback and use zero support. Earlier completion status can update history; current fraud labels do not enter predictors. The causal feature and label-isolation tests pass, but they cannot prove the undocumented upstream availability of every historical source value.

V13 combines several alert paths and has no single continuous risk score. The [machine-readable audit](ibm-audit.json) reports prevalence, confusion matrices, component average precision and component fraud capture at daily 1% and 5% budgets separately. It does not invent a combined score or equate binary-policy average precision with a continuous ranking curve. The retired deterministic rule engine is not resurrected as a supposedly comparable IEEE-CIS baseline.

## Implemented capability separation

- **Retained datasets:** the interface defaults to Behavioral observations, with prior counts, relative amounts and supporting records. These remain descriptive evidence, without fraud alerts or probabilities. The legacy HTTP request default is preserved for backward compatibility; the interface sends the selected mode explicitly.
- **V13:** remains an explicit benchmark comparison. New model results declare `evidenceScope=synthetic_benchmark`, `uploadDomainValidated=false`, and `probabilityAvailable=false`. Capabilities state that a matching schema does not validate a domain. Historical saved model results remain readable with the same conservative scope.
- **Temporary CSV imports:** default to graph investigation, which accepts supported transaction records even when model-only fields are absent. Building a graph does not call a model. The separate V13 benchmark-simulation import purpose retains strict model-field checks. Simulation remains an explicit action and still rejects unsupported inputs.
- **Graph and history:** existing exploration, evidence, editing, replay and retained assessments remain available. Display placeholders are explicitly described as unknown objects; shared placeholders do not establish real shared devices or locations. No missing MCC, channel, customer identity or device intelligence is invented to make a model appear applicable.
- **IEEE-CIS:** a separate chronological offline benchmark. It is not exposed as a model for ordinary uploads; the capability response declares IEEE inference unavailable. Its anonymized provider features cannot be reconstructed from normal statements by renaming columns.

The change adds no fraud probability to unfamiliar uploads and no new point-based fraud score. More elaborate anomaly detectors and graph models would need their own explicit semantics and evaluation; this revision does not claim they have been validated.

## Benchmark protocol

The IEEE-CIS files were already present in `training_data/ml-general/data/`. The separate [IEEE-CIS experiment](../ieee-v1/report.md) preserves original files, checks their hashes against the earlier structural audit, left-joins unique training identity keys to transaction keys, and separates fitting, selection, calibration and final periods using relative `TransactionDT`. Final targets remain excluded from selection. Public competition test files and sample-submission values are not used as labels.

The benchmark starts with a regularized logistic model on basic amount/card/address/email/device fields, compares CatBoost on those same fields, and then compares CatBoost using the complete provided feature set. This distinguishes a model-family change from adding provider information. Models are selected on validation; calibration uses a separate later period; all final predictions are frozen before extracting final labels. No benchmark model is promoted automatically.

No new download, rule acceptance, competition submission or redistribution occurred. The provided local files match their earlier workspace hashes, but official byte-equivalence and the original acquisition terms were not independently verified. Opaque feature construction and actual label delays remain limitations. The benchmark's final period is fifteen days, and authoritative account IDs are unavailable, so it cannot establish cross-institution or customer-disjoint performance.

## Verification and reproduction

Run the baseline audit from the repository root with `PYTHONPATH=backend` and `backend/.venv/Scripts/python.exe -m ml.strategy_audit`. The output is immutable. The audit includes its implementation digest; subsequent source formatting does not alter the recorded numerical results.

V13's bundle manifest remains `62eacb03874a2892fbff6f38becfe8cde512ef3b9b0dbb81e50c7e20756ea046`. Protected personal plans and the original datasets were not edited. See [validation](validation.json) for backend, frontend, browser and artifact checks.

References: [IBM's synthetic dataset description](https://github.com/IBM/TabFormer), [IEEE-CIS competition](https://www.kaggle.com/competitions/ieee-fraud-detection/data), and [chronological validation guidance](https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_5_ModelValidationAndSelection/ValidationStrategies.html).
