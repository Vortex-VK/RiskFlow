# Engine validation

Phase 4 is an offline, reproducible evaluation of the existing engine. It does not train a model, change scoring, alter the graph, or load evaluation records into a user's saved datasets. The intended claim is deliberately narrow: measured behavior on a frozen synthetic purchase benchmark. Real-world fraud effectiveness and operational authorization remain unvalidated.

## Protocol and separation

The [frozen protocol](simulator-evaluation/phase4/protocol.json) selects users 8-39 for diagnostics and 40-167 for reserved evaluation from the downloaded IBM synthetic transaction file. Users 0-7 were consumed in Phase 3. All records from January through June 2018 are selected without inspecting scores or labels. January-February supplies warm-up history; March-June supplies evaluation events. Historical profiles continue to update chronologically during evaluation, using earlier completed transactions regardless of their eventual label. There is no parameter fitting.

The source contains 24,386,900 records. The selected interval contains 65,085 records across 113 active users; 47 of the 160 preselected users have no records in the interval. Those empty users are recorded in the extraction manifest and are not replaced or treated as legitimate transactions. Fixed user IDs are a reproducible convenience sample, not a representative random population sample.

Extraction retains labels in separate outcome files. Scoring reads only transaction extracts and writes predictions before the reporting stage can join outcomes. The engine configuration, evaluation implementation, transaction extracts, outcomes, protocol and prediction files have recorded hashes. Changed inputs or code invalidate the report workflow; existing extraction, scoring and report directories cannot be overwritten. A successful scoring manifest is written only after every active preselected user has been scored.

The first run uses the existing 10-sample/7-day profiles and score thresholds of 40 for review and 70 for high priority. No scores or thresholds are tuned after looking at these reserved outcomes. Once reported, these accounts are consumed evaluation data and must not be described as unseen in a later tuning experiment.

## Source interpretation

This is the same adapter interpretation as Phase 3: `User` plus `Card` identifies an instrument-scoped account; dollar amounts are assumed USD; local clock fields are assigned a reproducible UTC convention, not a verified timezone. No-error rows become completed purchases, error rows become failed attempts, and negative amounts become unclassified incoming adjustments. Raw MCC values remain distinct. Card identifiers are not devices; merchant geography is not customer location. No customer demographics, fraud outcomes, inferred trust or invented account transfers enter scoring.

The source has no authoritative transaction IDs. IDs are hashes of non-label row contents plus duplicate occurrence. It also has no source-availability or real outcome-confirmation timestamps. This is retrospective historical analysis, not a reconstruction of decisions at original authorization time. Source documentation: [Altman's synthetic transaction paper](https://arxiv.org/abs/1910.03033), [IBM TabFormer](https://github.com/IBM/TabFormer).

Each user is scored in one bounded shard containing all their instruments and full selected warm-up history. This avoids changing application limits. It is valid for this source because all supported signals are instrument-local and device-sharing evidence is absent. **Do not reuse this partition strategy for data with shared-device or other cross-user signals.** A combined-versus-sharded regression test checks the supported case. This benchmark is not a claim that the application's importer accepts the entire multi-gigabyte source.

## Independent checks and comparisons

`backend/evaluation/reference.py` directly calculates purchase eligibility, strictly earlier completed-spending samples, lower-median amount baselines, sample/span/freshness availability, exact MCC novelty and inclusive five-minute attempt counts from adapted CSV rows. It imports no engine or profiling functions. Every scored event, including warm-up, must agree on final score, amount baseline, sample count, availability, velocity, and individual amount/category/velocity contributions. Equal-time attempts use the engine's published canonical-ID ordering, while same-time observations remain excluded from historical baselines.

Four frozen methods are reported:

| Method | Alert criterion | Interpretation |
| --- | --- | --- |
| Profiled engine | Existing score at least 40; high priority at least 70 | The current application engine |
| Static V1 | Existing static score at least 40; high priority at least 70 | With no supplied baselines/device/location, only velocity is available here |
| Velocity reference | At least three attempts in the inclusive five-minute window | Standalone reference signal, not the V1 combined-score policy |
| Amount reference | At least six times the independently calculated historical median | Unavailable without sufficient history; not silently a negative |

Reference methods have no high-priority policy; their simulated-false-block counts are null. Alert comparisons include both conditional recall on assessed records and end-to-end capture across all labelled source events, so unavailable amount history cannot improve recall by disappearing from the denominator. Zero V1 alerts do not prove better informed decisions.

## Outcome contract

`backend/evaluation/outcomes.py` accepts a separate CSV with `event_id,state,provenance,confirmed_at`. States are `confirmed_fraud`, `confirmed_legitimate`, `synthetic_fraud`, `synthetic_legitimate`, `pending`, and `disputed`. Missing rows mean absent outcomes. Duplicate or unmatched IDs fail; missing provenance and unsupported states fail. Real confirmed states require a timezone-aware confirmation timestamp. A configurable as-of cutoff and maturity interval after confirmation determine whether a confirmed label is usable. Pending, disputed, absent and immature outcomes never count as legitimate negatives.

IBM's Yes/No outcomes are explicitly synthetic, with provenance tied to the source hash and no invented confirmation date. The frozen benchmark sets maturity to zero because the source cannot establish real label latency. This does not validate delayed chargeback handling. Future independent outcomes need their own provenance, explicit maturity policy, population and protocol; they must not be mixed with synthetic labels under a real-fraud claim.

The reusable outcome parser and metric functions support incomplete outcomes, but this specific IBM runner requires exact label coverage of every extracted source row. Outcome revisions require a new immutable evaluation run; no label changes flow back into account profiles.

## Metrics and their limits

- Confusion counts, precision, recall and false-positive rate use assessed records with usable outcomes. Zero denominators produce null, never zero or perfect performance. Alerts with unknown outcomes are counted separately.
- Coverage includes all evaluation source records, excluded records/reasons, unscored fraud labels, rule availability and profiled 0/6 through 6/6 coverage. No unsupported adjustment is counted as a true negative.
- Workload includes alerts per 1,000 assessed events, false alerts per 1,000 legitimate assessed events, accounts with alerts, median/maximum alerts per account, and alerts on accounts whose entire observed evaluation history is labelled legitimate.
- High-priority legitimate events are reported as **simulated** false blocks, following the existing score-70 policy. No payment is actually blocked. Review burden is alert count, not measured analyst time or money saved.
- Consecutive fraud-labelled events on the same instrument, with gaps of at most 24 hours, form an incident **proxy**. These are not independently confirmed cases. Missed and unscored events stay in the denominator. Delay is event time from a proxy's first fraud-labelled event to its first alerted fraud-labelled event; benign alerts do not count as detecting fraud. Delay is reported only for detected proxies alongside the number missed, never as operational response latency.
- Segments cover activity, source channel, status, profiled-history availability and profiled rule coverage. A narrow purchase benchmark cannot validate transfers, cash, device or location signals absent from its inputs.
- Deterministic 95% percentile bootstrap intervals resample whole source users, keeping their cards together, for 1,000 replicates. Undefined replicates are counted. These are conditional uncertainty estimates for this convenience sample, not guarantees about a bank population. Sparse fraud users, shared merchants and generator correlations can make intervals unstable; all-zero bootstrap results do not establish a true population upper bound of zero.

## Reproduce

From the repository root in PowerShell, using the existing Python environment:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
backend/.venv/Scripts/python.exe -m evaluation.benchmark prepare
backend/.venv/Scripts/python.exe -m evaluation.benchmark score
backend/.venv/Scripts/python.exe -m evaluation.benchmark report
```

Defaults use `training_data/phase4-extract`, `training_data/phase4-predictions`, and `docs/simulator-evaluation/phase4/results`. For a repeat run, pass new `--directory`, `--predictions` and `--output` paths as appropriate; keep the protocol unchanged when checking reproducibility. Raw source data, per-event predictions and outcome sidecars stay under ignored `training_data`. Tracked reports contain aggregates and hashes, not redistributed transaction rows.

The application and API contracts are unchanged. `backend/evaluation` contains offline tooling, separate from `backend/app/domain` scoring and `backend/app/storage` persistence. Tests are in `backend/tests/test_evaluation.py`; earlier profile/lifecycle/retained-history tests remain authoritative for mechanisms this card source cannot exercise.

## Acceptance and next decisions

Technical acceptance requires exact source accounting, independent arithmetic agreement, outcome-independent scores, deterministic replay, honest missing-data denominators, and no silently overwritten evaluation artifacts. Poor detection must remain visible even when those checks pass.

For the portfolio, this phase supplies a measured and inspectable benchmark. It does not pass the original plan's operational effectiveness gate. Real production thresholds, acceptable false-alert workload, shadow operation, reviewer feedback and drift monitoring require a domain owner and representative independent outcomes. They are explicitly deferred, rather than replaced with invented acceptance targets.

Any subsequent rule changes should be motivated by diagnostic evidence, developed on designated development data, then evaluated on newly reserved accounts or an independently selected source. Changing rules to improve this already inspected reserved cohort would invalidate an unseen-test claim. A second dataset is useful for external generalization later, but is not needed to complete this bounded validation.
