# Sample library

Choose **Samples** in the editing or playback toolbar. The 250-payment example
is selected initially. Open it and select **Simulate**, or download the same CSV.

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
