# Sample library

Choose **Samples** in the workspace toolbar or **Explore samples** in the empty workspace. Open an example and select **Simulate**, or download its CSV and import it manually. The 250-row example is selected initially.

## Current model results

All six IBM CSVs retain their original bytes and labels. These are the installed Upload-v9 review decisions, using its channel-specific cutoffs; the separate 90% highlight is not the decision rule.

| Sample | Rows | Fraud | Caught | Missed | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: |
| first-five | 5 | 0 | 0 | 0 | 0 |
| short-history | 50 | 7 | 2 | 5 | 0 |
| online-episode | 250 | 15 | 6 | 9 | 0 |
| mixed-channels | 1,000 | 19 | 19 | 0 | 0 |
| many-accounts | 5,000 | 113 | 83 | 30 | 0 |
| full-workspace | 10,000 | 123 | 93 | 30 | 0 |

The separate **card-review demo** contains 186 authored transactions and ten fraud labels. The main model catches nine frauds and flags one legitimate transaction. The specialist adds one legitimate review suggestion and no additional fraud detection. This example is authored, not an original IBM extract.

These are curated, overlapping demonstrations. They contain both detections and misses, and their counts must not be pooled into an independent benchmark. Each file starts its own history, so a transaction can score differently when more preceding transactions are supplied.

## Provenance

- Source: the local IBM TabFormer synthetic transaction file, `training_data/raw/ibm/credit_card_transactions-ibm_v2.csv`, containing 24,386,900 rows. SHA-256: `b01fa323c98522f8c710c7f7242581860c97c50183f1c5fa9e772e5c674a7f15`.
- Original positive-purchase field values and fraud labels are retained. Negative and zero amounts are excluded; positive failed attempts remain. Blank Errors? denotes completed purchases.
- The [catalog](../../frontend/src/features/samples/catalog.json) records exact source windows, row counts, CSV hashes and measured results. Adjacent per-sample JSON files retain source-line provenance; [current receipts](upload-v9/catalog.json) record the installed results.
- User + Card identifies an instrument. USD and UTC are disclosed adapter conventions. Merchant geography does not identify customer location. Outcome labels never enter predictors.
- These samples were selected from previously inspected data. They are not a new holdout. IBM labels are simulator outcomes, not bank adjudications. The source license is distributed with the sample CSVs.
- The largest example fits the existing 10,000-payment browser limit and uses the grouped graph.

## Maintenance

Recompute metrics without changing CSVs:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe scripts/refresh_samples.py
```

The helper verifies CSV hashes and applies the installed model. The backend regression suite checks frozen component decisions and exact authored-holdout probabilities without training caches.

The [archived guide](../archive/sample-library-before-cleanup.md) preserves previous model results and the original sample-selection audit. [Cross-dataset findings](../model-evaluations/candidate-cross-dataset-v1/report.md) describe the broader limitations.
