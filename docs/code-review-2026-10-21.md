# Codebase multireview and cleanup ? 2026-10-21

Scope: user-requested review of correctness, obsolete code, test effectiveness, symmetry, naming/placement and minor implementation choices. Engine-discrimination experiments were explicitly deferred to a later session. No model training, new detector, score-weight change or threshold change was performed.

Three parallel reviewers inspected backend runtime/storage, frontend/runtime contracts, and tests/evaluation. A second independent pass reviewed the resulting changes and packaging. The workspace has no Git repository; a local pre-edit recovery snapshot and source hashes were captured under `.cache/multireview-2026-10-21/` without datasets. Findings were checked against actual callers, independent calculations or deliberate in-memory faults before cleanup.

## Verified findings and fixes

| Finding | Change | Evidence |
| --- | --- | --- |
| Saved CSV uploads inherited the sandbox's 10,000-row / 5,000,000-character limits despite a retained API contract of 20,000 source rows / 5 MiB | `domain/csv.ts` accepts explicit parser limits; `domain/limits.ts` names retained limits; `HistoryPanel.tsx` supplies them. Sandbox defaults and the actual file-byte guard remain. | Retained 20,000 rows pass and 20,001 fail; sandbox still rejects over 10,000. Text-size boundaries are separate. A real backend preview accepts 10,001 unsupported transfer records as retained/unassessed; a browser regression covers the same upload. |
| History listing repeated filtering/deduplication already guaranteed by SQL and reconciled lifecycle for historical versions whose computed result was discarded | Simplified `backend/app/storage/history.py`; historical versions retain their explicit not-assessed reason. | Existing correction-history test now verifies latest-only listing, original revision, corrected metadata and historical status. |
| Production-browser configuration discarded the temporary database setting when overriding the development server | `playwright.release.config.ts` creates its own temporary data directory. | Production-build browser suite exercises saved datasets without creating the user's `.data` directory. |
| Container's non-root user could not create default retained storage, and local retained/training files were not excluded from build context | Docker creates and owns `/app/.data` for UID 10001, sets `RISKFLOW_DATA_DIR`, and `.dockerignore` excludes `.data` and `training_data`. | Static path/ownership review; deployment guide documents durable volume and verification requirements. Docker is unavailable here, so no container execution is claimed. |
| Docker frontend build omitted JSON fixtures imported by typechecked decoder tests | Build stage copies the fixture tree; runtime still copies only scenario fixtures. | Independent TypeScript compiler-host probe reproduced four TS2307 missing-module errors with the previous fixture visibility. |
| Standalone prototype duplicated obsolete UI/motion and had no production imports | Removed five `preview/` files and five prototype-only build/browser scripts: 1,550 lines. Active frontend motion, canonical fixtures and historical screenshots/reports remain. Removed stale commands and ignore entries. | Dependency search; active app imports its own `features/graph/node-motion.js`. Browser coverage exercises the actual application. |
| Seven implementation-only symbols were exported without external consumers | Removed only export modifiers for `ruleIds`, `freePosition`, `AccountProfile`, `EventDelta`, `CsvField`, `sectorNumber` and `ObjectOrigins`. | Source/test/script reference checks and TypeScript verification; live implementations remain. |

## Test quality: verified weak tests repaired

Two deliberate faults survived the original tests:

- Removing the merchant-range seven-day span guard passed all eight range tests because the existing short-history case already failed the distinct-date gate. The existing test now isolates three distinct dates over six days (reject) and exactly seven days (accept).
- Resampling individual events instead of whole users passed all eight evaluation tests because each test user had only one event. The existing test now includes multiple cards/events per user and an independently expected recall interval of `[0, 0.5]`.

After strengthening, both deliberate faults fail. Mutations ran only inside short-lived Python processes; production source was never patched for this exercise. No duplicate test functions were added for these gaps. New frontend limit tests and the retained-upload browser test cover the actual import defect.

No dead/uncollected test files, blanket skips, xfails or focused-only cases were found in the reviewed suites. The Chromium-only touch injection skip is appropriate and executes in the configured Chrome suite. This audit improves confidence; it is not proof that every possible defect is covered.

## Continuing rules and retained compatibility

- No handwritten comments were introduced. Existing unrelated graph/helper comments remain, as required by the plan; generated declarations and schema descriptions are not obsolete commentary.
- V1 sandbox simulation, old saved-assessment readers/defaults, database migrations and legacy event-hash handling remain active and tested. Deleting them would break current behavior or retained data.
- Independent evaluation calculators deliberately duplicate mathematics without importing the production implementation. Historical Phase 3 scripts and rejected development experiment reproducers are documented and still exercised or needed for reproducibility; they are retained outside runtime paths.
- Runtime storage, ingestion, scoring, schema, transport and presentation responsibilities remain separate. No broad renaming or directory reorganization has a demonstrated benefit for these fixes. Module-private exports and removal of the duplicate prototype reduce ambiguity without moving active behavior.
- Parser limits stay explicit per workflow. Shared parsing avoids another CSV implementation, while byte limits remain enforced against the uploaded file. No backend capacity increase or policy change was made.
- Historical-version listing skips work with no consumer; no cache or incremental scoring architecture was added. Remaining performance tradeoffs, including full history replay and the large frontend bundle, need measurements before a larger refactor.
- No new consequential product/scoring tradeoff requires a decision in this cleanup. Future detector promotion criteria and the optional statistical comparator remain explicit decisions in `plan.md`.

## Verification

- **204 backend tests passed**, including strengthened lifecycle, merchant-range and independent-bootstrap checks. Ruff lint/changed-file formatting and strict mypy over 41 source files passed.
- **185 frontend unit tests passed** across 17 files. TypeScript, ESLint, changed-file formatting and production build passed.
- **71 production-build browser scenarios passed** in Chrome (4.0 minutes), including the new 10,001-row retained import, saved assessments, replay, graph behavior, accessibility and refresh. Final export/format cleanup produced a byte-identical build to the one exercised by this suite.
- The OpenAPI contract is unchanged. All 38 canonical fixture payments passed the independent fixture checker. Production HTTP smoke passed for templates, validation/simulation, HTML, gzip/caching and missing routes.
- No user `.data` directory was created. Windows server shutdown needed manual termination of the verified test-owned Python listener after all scenarios completed; the final reporter then returned 71 passed with exit code zero. No user service was stopped.
- Docker runtime validation was not possible. The fixture omission was reproduced independently with a TypeScript compiler-host check; the directory ownership and build-context changes were statically reviewed. Existing bundle-size advisory remains.

## Limits and next work

The engine still has 1,681 false alerts and 4/32 detections on the latest reserved cohort; this cleanup does not claim a new benchmark result. All 29 scoring, schema and evaluation source files match their pre-cleanup hashes. Storage listing changed, so the historical activation artifact should remain historical rather than being rewritten to pretend its whole-code hash matches this cleanup.

Docker build/runtime verification remains outstanding because Docker is not installed. The existing approximately 685 kB bundle warning remains; no lazy-loading refactor was justified by this review. Production browser testing validates served assets and app behavior locally, not hosting, container permissions or real financial effectiveness. Further detection work is planned in `plan.md` and explicitly deferred by the user.
