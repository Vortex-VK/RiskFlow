# Stack-d5 application integration

The [review-controls update](review-controls.md) adds an adjustable upload-wide
investigation view and verified numerical explanations. The recorded API policy
and original migration checks below remain unchanged.

The accepted `nonlinear-stack-v2` research candidate, `stack_d5`, now supplies
both scenario simulations and retained CSV assessments. Its nine CatBoost model
files are copied unchanged. Eight experts feed reference-CDF logit scores into
the frozen depth-5 head alongside 33 portable history fields. No training,
model selection, or research-directory access occurs during application requests.

## Interpretation and review policy

The API records `engine-ml-stack-d5`, `ml-stack-d5`, and `assessment-v2.10`.
`model.ranking.rawMargin` is an uncalibrated ranking score;
`priorityPercentile` ranks it within the assessed upload, using average ranks
for ties. Neither is a fraud probability. `model.score` is null and
`probabilityAvailable` is false. Existing probability results remain readable.

Review uses the accepted runtime's default policy: each UTC day selects
`ceil(0.01 * assessed purchases)`, highest score first, then stable payment ID
ascending. This is a retrospective queue; small days can exceed 1% overall.
Adding later records can change selections and percentiles without changing
earlier raw scores. No automatic payment blocking or separate legacy specialist
queue is applied. The UI removes probability controls for new runs and presents
the recorded queue, available inputs and prior-history coverage.

Supported inputs are USD purchases, charges or authorizations with a positive
amount up to $1 million and stable account and merchant identities. Optional
category/MCC, channel, completion status and geography stay unknown when absent.
Date-only and mixed-precision uploads use whole-day history batches; calendar
signals are masked. Same-time observations do not inform one another. Source
namespaces keep account and merchant history separate. Retained unsupported
activity remains unassessed. Existing lifecycle reconciliation and knowledge
cutoffs still apply. Labels never enter inference.

## Verification and limitations

[Migration replay receipt](parity.json) records exact expert margins, stack
margins and review-queue agreement across the 13 existing CSV cases, plus a
mixed-date-precision case. One original case is entirely unsupported. This is
implementation parity on exposed development data, not fresh validation.
Small frozen parity fixtures run in the app test suite without research imports.
Tests also cover deterministic daily ceilings and ties, label exclusion,
chronology, optional fields, unsupported rows, artifact corruption, saved-result
reopening, API decoding and browser import/replay behavior.

The sample library was refreshed on 2026-10-29 for the current automatic
upload-wide queue. It retains the small IBM walkthrough and uses five curated
Sparkov account-history windows. The [sample library](../sample-library/README.md)
records selection methods, provenance, current metrics, false alerts and misses.
Old IBM CSVs and daily-policy receipts remain for historical regression checks;
the active cards use `stack-d5-auto/` receipts. These intentionally selected
examples are not fresh representative validation.

## Reproduction and packaging

`backend/model_artifacts/stack-d5/manifest.json` pins all nine model hashes,
the pickle-free NumPy reference scale, numerical feature code hashes, and
research provenance. Missing or corrupt artifacts fail closed with HTTP 503.
The new package is approximately 8.9 MB and uses existing runtime dependencies.
Docker already copies the model artifact directory; research remains excluded.
Historical packages are retained for historical explanations and regression tests.

From the repository root, with `PYTHONPATH=backend`:

- `scripts/export_stack_fixtures.py` refreshes only the new API fixtures.
- `scripts/refresh_samples.py` reproduces current sample metrics without changing CSVs.
- `scripts/export_contracts.py` and the frontend `generate:types` script update contracts.
The original packaging and research-parity tools are local research utilities,
excluded from the public repository along with training data and experiments.
Published frozen fixtures reproduce application inference without that directory.
The public checkout does not claim to reproduce model training.

Application services must be restarted to load this engine. Integration changes
are local; no hosted deployment or publication is performed by these scripts.
