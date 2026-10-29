# Sample library

Choose **Samples** in the editing or playback toolbar. The 250-payment example
is selected initially. Open it and select **Simulate**, or download the same CSV.

## Engine evaluation panel

**Model evaluation scope** shows a separate development evaluation of the installed
Stack-d5 head, not the curated samples or the Auto queue. The compact
[evaluation data](../../frontend/src/features/samples/evaluation.json) records all five
source populations, counts, the installed head hash and original receipt hash.
It can also be downloaded from the panel. No transaction records are included.

The source is the recorded `nonlinear-stack-v2/reports/source-metrics.csv`, filtered
to `cohort=all`, `policy=batch`, `budget=0.05`, model `stack_d5`.
The 484,663 payments comprise IBM TabFormer, Sparkov, Fraud Detection Handbook,
Household simulation and BankSim. Each dataset reviews its top 5%, rounded up.
Mean fraud recall gives each dataset equal weight: **80.1%** for Stack-d5.
Per-source detections and false alerts are available under Results by dataset;
the headline is not pooled accuracy or review precision.

The panel leads with two user-facing benefits: the measured fraud capture at a
limited review budget, and inspectable point contributions explaining a payment's
priority. A short engine description explains how eight specialist models feed
a final combining model with 33 history measures, and how Auto suggests a queue.
Technical capacity and package details stay in the downloadable data rather than
being presented as evidence of detection quality.

The packaged scoring bundle occupies **8,896,668 bytes (8.9 MB decimal)**: nine
CatBoost models, reference scales and the manifest. File sizes are recorded in the
snapshot. This excludes application code, runtime dependencies and in-memory
transaction data. Inference uses CPU and does not require a GPU or external model
API; this is not a comparative latency or memory benchmark.

Explainability is quantified by **two levels of checked arithmetic**, displayed
at **0.1-point precision**: observation contributions sum to each expanded check,
and check contributions sum to the centered priority score. Remaining context is
included explicitly. These are reconstruction guarantees for displayed results,
not a percentage of human comprehension or proof of fraud. See the
[calculation method](../stack-d5-integration/review-controls.md).
The downloaded evaluation data includes these definitions and current limits.

The model hash matches the locked research candidate and installed bundle.
These sources were exposed during development, so this is not independent
validation, an industry comparison or an estimate for arbitrary uploads.

## Current default results

These results use the installed **Stack-d5** model and the same automatic,
upload-wide review capacity as the app. They do not use the older daily 1% policy.
The queue is adjustable; [calculation and explanation method](../stack-d5-integration/review-controls.md).

| Sample | Source | Payments | Labeled fraud | Caught | Missed | False alerts | Selected for review |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| First five payments | IBM TabFormer | 5 | 1 | 1 | 0 | 0 | 1 |
| A short fraud burst | Sparkov | 50 | 7 | 7 | 0 | 0 | 7 |
| Two accounts, one incident | Sparkov | 250 | 5 | 4 | 1 | 6 | 10 |
| A thousand everyday purchases | Sparkov | 1,000 | 18 | 17 | 1 | 34 | 51 |
| Twelve account histories | Sparkov | 5,000 | 63 | 57 | 6 | 86 | 143 |
| The full workspace | Sparkov | 10,000 | 93 | 86 | 7 | 176 | 262 |

These are curated demonstrations selected using known outcomes and current-model
results, not independent or representative accuracy estimates. The 5- and 50-row
examples are focused incidents, not ordinary fraud prevalence. Larger examples
have 0.93%-2% labeled fraud and retain their misses and false alerts. No thresholds,
model weights, purchase amounts, categories or labels were tuned to the examples.
Each CSV supplies its own prior history; no hidden warmup or fraud feedback is used.

## Sources and selection

The 5-row IBM walkthrough is retained unchanged because it still demonstrates the
current model clearly. Its [attribution](../../frontend/public/samples/ibm/ATTRIBUTION.txt)
and Apache-2.0 license remain with the original assets.

The other five samples use [Sparkov simulated credit-card transactions](https://www.kaggle.com/datasets/kartik2112/fraud-detection),
dataset version 1, `fraudTest.csv`. The publisher lists CC0 (Public Domain).
The original source archive SHA-256 is
`4e32829b9ba5a6b17af707c513c15204011044df0e8971e431cedca3d8c0a8a1`.
[Attribution and transformations](../../frontend/public/samples/sparkov/ATTRIBUTION.txt).

Account cohorts are fixed groups of adjacent sorted source account IDs. Each
sample keeps every transaction in a contiguous chronological interval of its
cohort, including normal purchases surrounding the incident. Windows were
selected for useful detections, subject to a 2.5% fraud cap for the larger examples.
The focused 50-row incident allowed up to eight frauds. Selection by observed F1,
candidate counts, account cohorts, window offsets, exact source rows and CSV hashes
are recorded in the [selection receipt](showcase-selection-2026-10-29.json).
Source-wide windows were also evaluated but not selected.

Original amounts, timestamps, transaction identities, categories, merchant
identities and labels are retained. USD and UTC are explicit adapter conventions;
the source timestamps have no timezone. Account display aliases are added, and
merchant display names omit the universal `fraud_` prefix; neither changes scoring.
Unused simulated personal fields are omitted. Missing channel, status, device and
merchant geography stay unknown; customer location is not substituted for merchant
location. Labels are separate from all prediction inputs.

These source datasets have been exposed during development. The word `Test` in
the source filename does not make these curated samples an independent evaluation.
Private user uploads are not included in the public sample library.

## Reproduction

[Catalog](../../frontend/src/features/samples/catalog.json) and
[current score receipts](stack-d5-auto/catalog.json) record the current automatic
queue. Per-sample receipt files contain raw scores, flags and original labels;
`sources/` contains exact source-line provenance. Browser tests compare live model
scores and the UI's queue with the receipts, including a label-removal check.

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe scripts/refresh_samples.py
```

This verifies the CSV hashes and recomputes results without reselecting samples or
changing CSVs. Original full datasets and exploratory candidate results stay local.
Old IBM CSVs remain for compatibility tests; historical daily-policy receipts stay
in `stack-d5/`. They are not the active library's results. Largest active sample:
10,000 payments, within the current 25,000-payment and 5,000-object limits.
