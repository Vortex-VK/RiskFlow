# Directory cleanup

Completed 2026-10-26. The project now contains the current app, its required model components, useful maintenance tools, original source data and retained historical documentation.

## Removed

The inventory records **22,994 deleted files totaling 10,084,830,448 logical bytes** (10.08 GB / 9.39 GiB), with no failed deletions. Physical disk savings can differ because package caches may use hard links.

- Generated training features, prediction caches, trial weights and research logs.
- 77 unused research modules, superseded experiment/package scripts, and research-only feature extractors.
- The standalone Upload-v5 package, which is not a dependency of the installed model.
- Obsolete fitting/selection functions in retained inference modules, and tests dedicated to retired research pipelines.
- Old screenshots, demo recordings, report outputs, installer archives and package caches.
- The optional research dependency group and its unused PyArrow/psutil dependencies; the lock file and deployment requirements were refreshed.

[Detailed deletion inventory](removed.json.gz) is gzip-compressed JSON. Original feature/model contracts were not regenerated to accommodate the cleanup.

## Preserved and organized

All **90 project Markdown files** present in the original inventory were preserved byte-for-byte, either in place or at an explicitly recorded archive location. The main README and sample guide were rewritten for the current app after archiving their exact previous contents. Generated project Markdown was moved out of disposable caches. Downloaded third-party package-cache README files are not project history.

All **200 original source-data files** were retained and organized under `training_data/raw/ibm`, `ieee`, `handbook`, `sparkov` and `banksim`. Hashes were checked before and after the moves. [Source move inventory](source-data-moves.json).

The current engine still requires seven versioned bundles. Upload-v9 uses the Upload-v8 routing/online component, Upload-v7 card coverage component, V13 base components, card-pattern proposal and priority components, and specialist probability mappings. Their weights and manifests remain byte-for-byte unchanged. These are active dependencies, not unused candidates. [Component map](../../../backend/model_artifacts/README.md).

Saved-result schemas, decoders and regression fixtures remain because they keep existing stored results readable. No application data store was targeted. The local development toolchain and current production build remain usable.

## Verification

- **234 backend tests passed**, including exact authored-holdout probability parity, frozen component decisions, label independence, causal history, artifact corruption checks and retained-result persistence.
- **238 frontend unit tests passed** across 29 files.
- **12 browser tests passed**, covering all six IBM sample sizes, model replay, retained assessments, sample loading and compatibility guidance. Windows test-server teardown required explicit process cleanup after the assertions; Playwright then exited successfully.
- Ruff, mypy, TypeScript and ESLint checks passed. The production frontend built successfully.
- The fresh-server HTTP smoke test passed for health, templates, validation, exact simulation results, static assets, cache/gzip behavior and missing routes.
- The restarted local app reports `engine-ml-upload-v9`; its events and metrics match the frozen fixture. All six IBM sample metrics were recomputed and remained unchanged.
- A source import audit found no unreachable frontend modules. Runtime and regression tests no longer import retired research modules or read training caches.

The backend test count decreased because tests of removed training pipelines were retired. Tests of active inference and application behavior were preserved or adapted to compact, frozen receipts extracted before cache deletion. Expected model probabilities were not recalculated to make the cleaned implementation pass.

[Verification receipt](verification.json) ? [Preservation check](preservation.json) ? [Original fingerprints](before.json)

## Reproducibility boundary

Serving the app and running its regression suite do not require original datasets or generated training caches. Current benchmark summaries, sample lineage and compact prediction receipts remain available. Historical Markdown retains the sequence of experiments and their limitations, but retired training commands and some old generated-artifact links no longer resolve. Rebuilding those research pipelines would require reconstructing their code and derived datasets; this cleanup does not claim full training reproducibility.

## Interface cleanup: 2026-10-27

Removed 20 obsolete source, test and recording files: the unused score explorer, experimental card review queue, saved-dataset screens and client, comparison screen and helpers, stale sample metadata, and browser suites dedicated to retired screens. Mixed browser suites retain their current-workspace tests. Compare runs, its extra simulation snapshot and comparison-only graph styles were removed. CSV identity checks retain the shared canonicalization logic locally.

Removed generated Python/tool caches, old browser-test outputs, scratch scripts and screenshots, and empty retired directories (approximately 51 MiB). Active development logs, local dependencies, the rebuilt production frontend, all seven model bundles, original training data, saved databases, and compatibility decoders/fixtures were retained. Source files and unique scratch artifacts were backed up outside the project to `%TEMP%/riskflow-cleanup-20261027` before removal. The README and import guidance now describe the available interface; the former recording guide is marked historical.

Verification: 263 frontend unit tests, 251 backend tests, and 15 targeted browser tests passed. TypeScript, ESLint and the production build passed. The browser checks cover reruns without Compare runs, model preparation and explanations, shared connections, playback counters, threshold-aware results and CSV validation. The build retains its existing large-chunk warning. An entry-point import audit (including JavaScript implementations paired with declarations) found no orphan frontend modules. No model contracts or prediction fixtures were changed for this cleanup.
