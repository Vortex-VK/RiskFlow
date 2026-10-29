# Sample library

Choose **Samples** in the editing or playback toolbar. Open an example and select **Simulate**, or download its CSV and import it manually. The 250-row example is selected initially.

## Fixed-budget reference results

The installed model is **Stack-d5**. This reference table uses its original fixed daily review queue: `ceil(0.01 * assessed purchases)` per UTC day. Scores are rankings, not calibrated fraud probabilities. Small days can produce an overall review rate above 1%.

Replay now offers an automatic upload-wide queue and a Review capacity control. Its results can differ from this fixed-budget table. [Queue and explanation method](../stack-d5-integration/review-controls.md).

The first three examples were selected on 2026-10-26 for successful detections with the previous Upload-v9 engine. Their source rows are unchanged; the table below reports the current stack on those same files.

| Sample | Rows | Fraud | Caught | Missed | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: |
| first-five | 5 | 1 | 1 | 0 | 0 |
| short-history | 50 | 5 | 0 | 5 | 2 |
| online-episode | 250 | 15 | 0 | 15 | 7 |
| mixed-channels | 1,000 | 19 | 8 | 11 | 164 |
| many-accounts | 5,000 | 113 | 27 | 86 | 102 |
| full-workspace | 10,000 | 123 | 38 | 85 | 222 |

These curated, overlapping demonstrations are exposed development evidence, not a representative accuracy estimate. The 250-row example now catches none of its 15 labeled frauds at this budget. Each file starts its own history; supplying more history or changing the upload can change scores and queue membership. No sample rows or labels were changed for the integration.

[Current receipts](stack-d5/catalog.json) record Stack-d5 results. Historical Upload-v9 receipts remain local; their different review policy is not an equal-budget model comparison. The separate card-review demo remains available as a CSV regression fixture but is absent from the Samples menu.

[Selection receipt](showcase-selection-2026-10-26.json) records the source rows and original selection outcomes. Superseded samples and catalogs remain in the local archive, excluded from Git. The internal ID `online-episode` labels the current card-fraud example.

## Provenance

- Source: the local IBM TabFormer synthetic transaction file, `training_data/raw/ibm/credit_card_transactions-ibm_v2.csv`, containing 24,386,900 rows. SHA-256: `b01fa323c98522f8c710c7f7242581860c97c50183f1c5fa9e772e5c674a7f15`.
- Original positive-purchase field values and fraud labels are retained. Negative and zero amounts are excluded; positive failed attempts remain. Blank Errors? denotes completed purchases.
- The [catalog](../../frontend/src/features/samples/catalog.json) records exact source windows, row counts, CSV hashes and measured results. Adjacent per-sample JSON files retain source-line provenance; [current receipts](stack-d5/catalog.json) record the installed results.
- User + Card identifies an instrument. USD and UTC are disclosed adapter conventions. Merchant geography does not identify customer location. Outcome labels never enter predictors.
- These samples were selected from previously inspected data. They are not a new holdout. IBM labels are simulator outcomes, not bank adjudications. The source license is distributed with the sample CSVs.
- The largest example fits the existing 10,000-payment browser limit and uses the grouped graph.

## Maintenance

Recompute metrics without changing CSVs:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe scripts/refresh_samples.py
```

The helper verifies CSV hashes and applies the installed model. The backend regression suite checks frozen stack margins, queue decisions and historical explanation compatibility without training caches.

The public repository includes only the curated synthetic sample subset, its lineage and current results. Original datasets and historical research reports remain local. See the [repository policy](../repository-policy.md).
