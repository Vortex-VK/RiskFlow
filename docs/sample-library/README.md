# Sample library

Choose **Samples** in the editing or playback toolbar. Open an example and select **Simulate**, or download its CSV and import it manually. The 250-row example is selected initially.

## Current model results

The first three examples were reselected on 2026-10-26 to demonstrate successful detections with the installed engine. They contain contiguous windows from the unchanged 10,000-row IBM example. Original field values and fraud labels are preserved; the 1,000-, 5,000-, and 10,000-row files are unchanged. These are the installed Upload-v9 review decisions, using its channel-specific cutoffs; the separate 90% highlight is not the decision rule.

| Sample | Rows | Fraud | Caught | Missed | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: |
| First five payments | 5 | 1 | 1 | 0 | 0 |
| A short fraud burst | 50 | 5 | 5 | 0 | 0 |
| Card fraud across accounts | 250 | 15 | 15 | 0 | 0 |
| mixed-channels | 1,000 | 19 | 19 | 0 | 0 |
| many-accounts | 5,000 | 113 | 83 | 30 | 0 |
| full-workspace | 10,000 | 123 | 93 | 30 | 0 |

The separate card-review demo was removed from the Samples menu: specialist scores already feed the final detector, and the demo's extra review adds no fraud detection under the current policy. Its CSV and historical receipts remain available for regression testing through ordinary import.

These are curated, overlapping demonstrations deliberately selected using observed model outcomes. Their success rates are not an unbiased or representative accuracy estimate. Each file starts its own history, so a transaction can score differently when more preceding transactions are supplied. The first three now show complete detection; the larger examples still include misses. No model weights, decision thresholds, or labels were changed.

[Selection receipt](showcase-selection-2026-10-26.json) records every original source row, parent-file hash, candidate windows, and measured outcome. [Previous samples and catalog](archive-before-showcase-2026-10-26/catalog.json) preserve the superseded files and results. The legacy internal ID `online-episode` now labels the card-fraud example; visible titles describe the current contents.

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
