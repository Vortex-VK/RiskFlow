# Verification record

- Full backend suite: **191 passed** (including eight new validation tests).
- Ruff checks: `app`, `evaluation`, `tests` passed; new evaluation files and tests passed formatter checks.
- Strict mypy: **38 source files** across `app` and `evaluation` passed.
- Independent raw-input reference: **62,054 eligible attempts**, including warm-up, matched eligibility, historical amount availability/sample counts/baselines, amount/category/velocity points and final scores.
- Full deterministic replay: **113 prediction files and the scoring manifest were byte-identical** on a second complete run. The replay did not alter configurations or select different accounts.
- Controlled metric oracle covers TP/FP/FN/TN, unknown outcomes, exclusions, zero denominators and simulated false blocks. The independent reference test exercises positive/negative amount boundaries, failed-history exclusion, equal-time attempts and prefix invariance.
- Outcome tests cover provenance, unsupported states, confirmation timing, maturity, disputes, pending/absent labels, duplicate IDs and foreign IDs.
- Pipeline tests cover label independence, reversed-input determinism, combined-versus-sharded equivalence for this source, all-row selection, empty users without replacement, file-hash tampering and overwrite rejection.
- Existing retained-history, lifecycle, profile, API and V1 tests remain passing. Application code, schemas, OpenAPI, frontend and graph behavior were not changed; frontend/browser suites were not rerun for this offline-only change.
- No added handwritten code comments, skipped/focused tests, new dependencies, persistent user datasets, server restarts or public deployment. `.data` remained absent.

The source and aggregate outcome metrics establish synthetic benchmark behavior only. A passing test suite and exact replay do not validate real-world fraud accuracy.
