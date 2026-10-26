# Repeated merchant spending and amount alerts

The repair addresses one specific source of false alerts: an account-wide purchase median can make a repeated, ordinary large purchase look newly unusual. It does not treat a familiar merchant as trustworthy or promise to detect fraud whose behavior looks ordinary.

The active `profiles-v2` method retains the existing account-wide median, minimum history and 3x/6x amount rule. It adds a narrow explanation for an otherwise unusual amount when all these conditions hold:

- The account already has a usable historical purchase baseline. Configured fallback baselines and merchant-specific bill profiles retain their existing behavior.
- The current transaction has a source merchant identifier and a category. The supporting transactions share that merchant identifier, normalized category, account, source namespace and currency.
- At least three completed, recognized spending intents occurred on at least three dates, spanning at least seven days, within the purchase history window. The newest supporting observation satisfies the existing freshness limit.
- Supporting records were available strictly before the current transaction. Current, same-time, future, failed, pending and unresolved spending cannot establish the range.
- The current amount is no greater than the largest supporting completed purchase amount.

When these hold, the amount signal contributes zero points. Above that observed maximum, or without sufficient matching history, the original amount rule applies. Device, location, category, velocity and device-sharing rules remain active. Partial captures belonging to one underlying purchase count as one intent, using their recognized combined spending; they cannot establish three repeated purchases by themselves. Refunds are not new training purchases.

The range is observed behavior, not a confidence interval or a legitimate-spending label. A prior undetected fraudulent purchase can influence it, just as it can influence other historical baselines. Three observations are a deliberate small-evidence gate, not a statistically proven optimum. This repair should not be interpreted as clearing a payment, trusting a merchant, or establishing bank-grade fraud performance.

## Evidence and compatibility

New assessments are `assessment-v2.4`, with `engine-v3` and `profiles-v2`. Existing six-rule weights and review/high-priority thresholds remain unchanged. Old V1 simulations and saved `assessment-v2.1` through `v2.3` results remain readable without recalculation; explicitly selecting `profiles-v1` retains the previous profiling behavior.

Each applicable amount signal contains a `merchantRange` evidence record: merchant/category, number of intents and dates, first/last observations, observed maximum, source evidence IDs/count/hash. The UI explains the range beside the unchanged pooled median and other rule evidence. Frontend decoding verifies version pairing, sample/date/freshness bounds, range arithmetic, evidence identity and source-account scope. Missing range evidence cannot silently justify zero amount points.

Implementation responsibilities: `backend/app/domain/merchant_range.py` calculates the matching range from eligible grouped spending supplied by `profiles.py`; `schemas/profiles.py` owns the evidence contract. `frontend/src/api/decodeMerchantRange.ts` validates it, and `ProfileDetails.tsx` presents it. `backend/evaluation/merchant_range.py` independently calculates the benchmark expectation directly from CSV inputs, without importing the domain implementation.

## Selection history

The [development design](simulator-evaluation/purchase-v2/design.md) predeclared three broad amount candidates and a 25% false-alert reduction/no-lost-detection target. All three lost detections. A new-merchant activity hypothesis also failed. They were not promoted.

The narrower observed-range candidate preserved 15/83 development detections and reduced legitimate alerts from 2,244 to 1,877 (16.4%). This did **not** pass the original 25% target. The user explicitly approved validating and shipping this smaller improvement if it held on fresh accounts. The [selected protocol](simulator-evaluation/purchase-v2/selected-protocol.json) records that decision before reserved outcome inspection; it does not retroactively claim the original gate passed.

The reserved comparison uses new users 296-423, with January-February 2018 warm-up and March-June evaluation. Users 168-295 are development; previously consumed users 0-167 are excluded. Every selected source row is retained, including unsupported transactions and empty preselected users. Source assumptions and real-world limits from [Phase 4](engine-validation.md) still apply.

The original extracts remain in `training_data/purchase-v2`. The frozen selected manifest in `training_data/merchant-range-validation` references those exact files and preserves the original extraction-protocol hash. Only the assessment configuration changed between extraction and candidate freeze; no rows or labels were changed or reselected.

Reproduce scoring and reporting with new output directories:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
backend/.venv/Scripts/python.exe -m evaluation.benchmark score --protocol docs/simulator-evaluation/purchase-v2/selected-protocol.json --directory training_data/merchant-range-validation --predictions training_data/merchant-range-repeat
backend/.venv/Scripts/python.exe -m evaluation.benchmark report --protocol docs/simulator-evaluation/purchase-v2/selected-protocol.json --directory training_data/merchant-range-validation --predictions training_data/merchant-range-repeat --output training_data/merchant-range-repeat-results
```

The report includes the previous profiled engine on exactly the same records, reconstructed by the independently checked original rule calculation. Source labels never enter either scoring path. This remains an assessment of synthetic data, not a calibrated fraud-probability model or operational authorization test.
