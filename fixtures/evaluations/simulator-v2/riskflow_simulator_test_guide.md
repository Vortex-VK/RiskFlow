# RiskFlow simulator test dataset (synthetic)

The primary file is `riskflow_simulator_realistic_2400.csv` (2,400 transactions, 70 accounts, Aug 1–Oct 19, 2026). The import file has the **same 19 columns** as your previous CSV and contains no planted fraud labels, risk scores, or expected decisions.

This is a **purpose-built synthetic validation dataset**: most transactions resemble everyday banking activity; a small minority are realistic examples of concentrated activity. No synthetic generator can substantiate real-world incident frequencies. No real customer data is included.

## Cases to inspect after import

| Case | Timestamp window (UTC) | Transaction IDs | What to inspect |
|---|---|---|---|
| S1 | 2026-09-09T14:34:04Z – 2026-09-09T14:35:59Z | TXN-RFSIM-2026-001193, TXN-RFSIM-2026-001194, TXN-RFSIM-2026-001195, TXN-RFSIM-2026-001196 | Checkout retry sequence: three declines followed by success |
| S2 | 2026-09-14T20:11:05Z – 2026-09-14T20:14:34Z | TXN-RFSIM-2026-001357, TXN-RFSIM-2026-001358, TXN-RFSIM-2026-001359, TXN-RFSIM-2026-001360, TXN-RFSIM-2026-001361 | Five quick card-present purchases (velocity alone can remain below review threshold) |
| S3 | 2026-09-21T22:15:02Z – 2026-09-21T22:18:03Z | TXN-RFSIM-2026-001588, TXN-RFSIM-2026-001589, TXN-RFSIM-2026-001590, TXN-RFSIM-2026-001591, TXN-RFSIM-2026-001592, TXN-RFSIM-2026-001593, TXN-RFSIM-2026-001594 | Unfamiliar online device with multiple short-interval payment attempts |
| S4 | 2026-10-04T22:15:02Z – 2026-10-04T22:18:02Z | TXN-RFSIM-2026-001971, TXN-RFSIM-2026-001972, TXN-RFSIM-2026-001973, TXN-RFSIM-2026-001974, TXN-RFSIM-2026-001975, TXN-RFSIM-2026-001976 | Unfamiliar online device with multiple short-interval payment attempts |
| S5 | 2026-09-27T16:12:05Z – 2026-09-27T16:15:03Z | TXN-RFSIM-2026-001730, TXN-RFSIM-2026-001731, TXN-RFSIM-2026-001732, TXN-RFSIM-2026-001733 | Shared household tablet used for purchases from three accounts |
| S6 | 2026-10-08T19:08:11Z – 2026-10-08T19:11:32Z | TXN-RFSIM-2026-002094, TXN-RFSIM-2026-002095, TXN-RFSIM-2026-002096, TXN-RFSIM-2026-002097, TXN-RFSIM-2026-002098, TXN-RFSIM-2026-002099, TXN-RFSIM-2026-002100, TXN-RFSIM-2026-002101 | Device reused across three unrelated accounts plus a subsequent rapid sequence |
| S7 | 2026-08-28T17:29:10Z – 2026-08-28T17:31:41Z | TXN-RFSIM-2026-000823, TXN-RFSIM-2026-000824, TXN-RFSIM-2026-000826 | Shared device from three accounts but no account has high payment velocity |
| S8 | 2026-09-30T17:32:13Z – 2026-09-30T17:32:13Z | TXN-RFSIM-2026-001798 | A large one-off purchase; will not score for amount without a configured typical amount |
| S9 | 2026-10-14T17:32:13Z – 2026-10-14T17:32:13Z | TXN-RFSIM-2026-002261 | A large one-off purchase; will not score for amount without a configured typical amount |
| S10 | 2026-10-07T17:27:14Z – 2026-10-11T18:31:14Z | TXN-RFSIM-2026-002036, TXN-RFSIM-2026-002037, TXN-RFSIM-2026-002091, TXN-RFSIM-2026-002138, TXN-RFSIM-2026-002167, TXN-RFSIM-2026-002189 | An account makes multiple ordinary purchases during a multiday trip to Canada |
| S11 | 2026-10-11T18:31:00Z – 2026-10-13T20:50:00Z | TXN-RFSIM-2026-002188, TXN-RFSIM-2026-002237 | Purchase followed by a partial merchant refund |

These timestamps and IDs are for navigation, not ground-truth fraud labels. Some transactions within a case may legitimately receive different decisions, depending on the engine configuration.

## What this can and cannot test

- Under default settings, inspect velocity, shared-device use, and new-device classification. Whether declined attempts are counted depends on your import/engine behavior.
- Unusual amount, category deviation and unusual location require account baselines. The separate `riskflow_simulator_reference_profiles.csv` provides *August-only observational reference baselines*, but is **not automatically imported or consumed by the existing engine**.
- Baselines are deliberately imperfect: an account with little August activity may have a blank typical amount/category/device list; the engine should handle missingness explicitly.
- The purpose of S6 is to test combined velocity + device sharing on the same transaction and chronological window semantics; S2 tests that even intense payment velocity alone (max 35 points) falls below the 40-point review threshold.
- Scores are **not fraud probabilities**. The CSV has no verified fraud labels, so precision/recall/accuracy are not measurable from it.
- The 19-column schema has no beneficiary/counterparty account, so a transfer network cannot be reconstructed from it.

## Approximate independently computed checks

- 2,400 rows; 70 distinct account IDs.
- 18 purchase rows have >=3 purchases/attempts by the same account in their past 5-minute window (including current); 8 have >=5.
- 9 purchase rows have >=3 distinct account IDs on the same non-empty device in the last 5 minutes (including current).
- These checks do **not** reproduce your engine; they assume completed, pending, and declined purchase records all count and do not account for exact engine eligibility filters or preloaded account familiarity.

## Suggested engine work, in priority order

1. Establish baselines from an explicit **historical observation period**, not the same future transactions the engine is deciding on. Require sufficient sample size, expose unknown data as unknown.
2. Make device familiarity stateful: when first seen, how often used, and whether confirmed trusted; use events only up to the timestamp being scored.
3. Add a replayable simulation audit log with `transaction_id`, timestamp, applicable rule points, reference baselines, score and final decision. Include reason codes for rules that could not run.
4. Distinguish attempts, posted transactions, declines and refunds, and set clear rules for what counts toward velocity (a 5-minute checkout retry should not be treated the same as five independent paid purchases).
5. Permit a distinct outcome such as `insufficient_data`, and examine combination thresholds: velocity-only tops out at 35, so even seven rapidly repeated payments might be auto-approved without a second flag.
6. Support counterparty account IDs (or external merchant/payee IDs) if you want genuine account-to-account graph analytics, separate from the risk rules.
7. Keep outcome validation independent of rule triggers: use curated but anonymized labeled cases or expert-reviewed outcomes when measuring real detection performance.
