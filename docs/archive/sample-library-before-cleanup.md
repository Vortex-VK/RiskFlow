# IBM sample library

## Active engine update: Upload-v8 (2026-10-25)

The user selected **Upload-v8 / precision95**. All six original IBM CSVs and labels retain their exact bytes. The [active catalog](upload-v8/catalog.json) and browser results use v8; older catalogs remain preserved.

| Sample rows | Fraud | Caught | Missed | False alerts |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 0 | 0 | 0 | 0 |
| 50 | 7 | 6 | 1 | 0 |
| 250 | 15 | 8 | 7 | 0 |
| 1,000 | 19 | 19 | 0 | 0 |
| 5,000 | 113 | 96 | 17 | 0 |
| 10,000 | 123 | 107 | 16 | 0 |

Separate card-pattern suggestions are not included in these fraud-model counts. Some samples regress relative to v7; the original labels and rows were not altered to conceal that. Recompute v8 receipts with `scripts/refresh_upload_v8_samples.py` and `PYTHONPATH=backend;.`.

The library also offers **Open card-review demo**, a separate 186-row subset of the supplied authored scenario data. It is explicitly not original IBM data or validation. The reviewer suggests three labeled frauds and one legitimate purchase; v8's own results are zero detections and six false alerts. [Provenance and results](../model-evaluations/card-pattern-v1/demo.json), [specialist limitations](../model-evaluations/card-pattern-v1/report.md).

## Historical engine update: Upload-v7 (2026-10-25)

The app uses **Upload-v7 / balanced**, after its predeclared replacement criteria passed. The six CSV files, labels, source windows and hashes are unchanged. The active catalog and live browser results describe Upload-v7. Original [V13](v13-catalog.json) and [Upload-v5](upload-v5/catalog.json) catalogs and per-event receipts remain preserved.

| Sample rows | Fraud | Caught | Missed | False alerts |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 0 | 0 | 0 | 0 |
| 50 | 7 | 4 | 3 | 0 |
| 250 | 15 | 10 | 5 | 0 |
| 1,000 | 19 | 19 | 0 | 0 |
| 5,000 | 113 | 98 | 15 | 0 |
| 10,000 | 123 | 108 | 15 | 0 |

These are curated, overlapping demonstrations. The largest example has 87.80% recall; the research population's 90%/90% result cannot be transferred to this or arbitrary uploaded files. Zero false alerts here does not establish zero false alerts elsewhere. [Active catalog and receipts](upload-v7/catalog.json), [installation receipt](upload-v7/installation.json), [model evidence](../ml.md).

To recompute active metrics without changing CSVs, set `PYTHONPATH=backend;.` and run `backend/.venv/Scripts/python.exe scripts/refresh_upload_v7_samples.py`. The older Upload-v5 refresh rejects execution against another installed engine. The original source-preparation runner below writes the V13 archive, preserving the active model catalog.

The rest of this document records the original V13 sample implementation and audit, not the current model's results.

Implemented 2026-10-25. Open **Samples** in the workspace toolbar, **Explore samples** in an empty workspace, or **Browse IBM samples** in Import CSV. Select a sample to preview its size, date range and investigation prompt. Open it directly, then select **Simulate**, or download the same CSV for manual import. The sample picker closes with its close button or Escape, including during loading.

The old static canvas checklist has been replaced with a compact sample entry point. A guided, interactive tutorial is deferred; this library is not presented as that tutorial.

## Files and measured behavior

All six files contain original positive-purchase rows from the locally supplied IBM synthetic dataset. Original field values and fraud labels are preserved. Each file is self-contained; there is no hidden history or cached inference substituted for a live run.

| Sample | Transactions | Card histories | Labeled fraud | Caught | Missed | False alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| First five payments | 5 | 3 | 0 | 0 | 0 | 0 |
| A short online history | 50 | 1 | 7 | 4 | 3 | 0 |
| An online fraud episode | 250 | 6 | 15 | 8 | 7 | 0 |
| Across payment channels | 1,000 | 4 | 19 | 6 | 13 | 0 |
| Many accounts, one view | 5,000 | 53 | 113 | 40 | 73 | 0 |
| The full workspace | 10,000 | 54 | 123 | 40 | 83 | 0 |

The 250-row example is selected initially. All files fit the existing 10,000-payment, 1,000-object and 5 MB sandbox limits. The largest creates 752 objects and uses the existing grouped graph. It is the supported interactive ceiling, not a claim of unlimited browser scalability.

These are **curated demonstrations**, not a new independent evaluation. Users and windows were chosen after inspecting known fraud episodes in existing research outputs. Within each declared window, chronological head/tail selection determines the rows. No transaction values, labels, model weights or thresholds were changed to improve predictions. The five-transaction sample illustrates sparse history; the other samples preserve both caught and missed fraud. Zero false alerts on these chosen examples does not establish zero false alerts on other data. Samples overlap and their counts must not be pooled into an independent benchmark.

## Provenance and assumptions

- Local source: `training_data/credit_card_transactions-ibm_v2.csv`, 24,386,900 rows; SHA-256 `b01fa323c98522f8c710c7f7242581860c97c50183f1c5fa9e772e5c674a7f15`.
- Dataset origin: [IBM TabFormer](https://github.com/IBM/TabFormer), which describes the data as synthetic credit-card transactions. The repository's Apache-2.0 license is included with the samples. Byte-equivalence of the local release to the current upstream archive has not been established.
- The [catalog](../../frontend/src/features/samples/catalog.json) records exact user/time selection rules, source/model/file hashes, counts and measured outcomes. Adjacent per-sample JSON receipts map browser event IDs to original one-based source-file line numbers, including the header.
- These samples come from previously inspected source data. We make no new holdout or independently verified training-exclusion claim.
- Native IBM columns use `User + Card` as instrument identity. USD and UTC are documented adapter conventions; absent seconds remain `:00`. Blank `Errors?` means completed and other values mean failed attempts.
- Negative and zero amounts are excluded. Positive failed attempts remain present. No identity, device, customer location or missing model feature is invented. Existing graph placeholders remain explicitly unknown.
- `Is Fraud?` is included for outcome comparison through the existing importer. It never enters V13 predictors. Fraud outcomes are generator labels, not real bank adjudications.
- Every file starts its own history. Confirmed delayed merchant-fraud feedback remains unavailable. Its results are therefore different from the published full-context IBM benchmark.

## Source and runtime audit (2026-10-25)

An independent scan checked all 16,305 packaged rows (10,005 unique source rows, because the samples overlap) against their recorded physical lines in the original local CSV. All fields and fraud labels matched, and the full source SHA-256 matched the recorded hash. This verifies extraction from the local dataset; it does not establish byte-equivalence to the upstream archive.

The largest sample reproduces 40 detections out of 123 labeled frauds: **32.52% recall**, with 83 misses and zero observed false alerts. A diagnostic matched 3,594 of its transactions, including 97 frauds, to the historical full benchmark. On these same transactions:

| Input conditions | Fraud caught | Recall |
| --- | ---: | ---: |
| Historical cached features | 76 / 97 | 78.35% |
| Same cached features, merchant feedback zeroed | 28 / 97 | 28.87% |
| Actual upload feature builder | 32 / 97 | 32.99% |

The counterfactual keeps all other historical features fixed. It demonstrates substantial dependence on delayed merchant-fraud feedback, which uploads cannot supply. Within numerical tolerance, the other differences on this matched subset are merchant-wide activity features; account-history features agree. This does not prove those remaining differences are harmless, or establish performance on a new population. The old 79.09% full-benchmark recall must not be presented as upload performance. Passing integration tests establishes that the app reproduces these predictions, not that those predictions detect fraud adequately.

See the [diagnostic receipt](provenance-and-runtime-audit.json) for source verification, matched channel counts, feature differences and reproduced predictions. No sample labels, runtime policy or model weights were changed during this audit.

## Implementation and reproduction

- [CSV files and attribution](../../frontend/public/samples/ibm/) are public frontend assets, fetched only when opened or downloaded. The source's 2.35 GB dataset is not packaged with the app.
- [Preparation script](../../scripts/prepare_ibm_examples.py) hashes and scans the local source in 100,000-row chunks, retains only the declared users/year, selects samples and computes frozen V13 predictions using the runtime feature builder.
- [Sample loader](../../frontend/src/features/samples/samples.ts) checks file size/hash, uses the same parser and builder as ordinary imports, and rejects incompatible or incomplete assets before replacing a workspace.
- [Sample library](../../frontend/src/features/samples/SampleLibrary.tsx) uses a native modal dialog with keyboard dismissal, cancellation, responsive layout, outcome details and downloads. Opening uses the existing replacement flow; edited work is not silently discarded.
- No backend API, prediction policy, dependency, saved-dataset schema or V13 artifact was changed. Existing authored scenarios remain available under Scenario options.

From the repository root in PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
backend/.venv/Scripts/python.exe scripts/prepare_ibm_examples.py
```

This regenerates the six example CSVs, catalog and per-event receipts, using the fixed selection rules. It requires the retained source and existing model runtime. It does not retrain a model or rewrite historical benchmark artifacts. Runtime serving only requires the packaged frontend assets and existing V13 bundle.

## Verification

The sample asset tests verify sizes, hashes, graph limits, identities, source-label counts and identical model inputs with labels removed. Browser tests download each file, open all six through the real frontend, call the actual V13 API and compare every alert with its recorded receipt. They also cover mobile layout/accessibility, cancellation, load errors, refresh isolation and label-independent predictions. See [verification record](verification.json) for completed checks.
