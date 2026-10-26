# Historical profiles (Phase 3)

Saved datasets now calculate account-specific statistical baselines. There is no fitted regression model, shared training corpus, or dependency on the accounts in a demonstration CSV. Each assessment uses the selected dataset's own earlier eligible records. Temporary sandbox simulations retain their authored V1 behavior.

## Calculation contract

Phase 3 introduced `assessment-v2.3`, `engine-v2` and `profiles-v1`, alongside `retained-v2`, `rules-v1` and `lifecycle-v1`. New saved assessments now use `assessment-v2.4`, `engine-v3` and `profiles-v2`: the [merchant amount range](merchant-amount-range.md) can suppress amount points when sufficient earlier completed spending at the same merchant and category covers the current amount. The other calculations below remain applicable. Six rule weights and investigation thresholds are unchanged. Four signals receive per-event historical context; the existing five-minute attempt/sharing calculations are reused. Old frozen assessments remain readable without recalculation.

| Population | Window | Minimum samples | Minimum span between oldest/newest samples | Maximum age of newest sample |
| --- | --- | --- | --- | --- |
| Ordinary purchases, within account/source/currency | 90 days | 10 | 7 days | 30 days |
| Explicit bills, additionally separated by merchant | 180 days | 3 | 28 days | 62 days |
| Device familiarity | 90 days | 3 completed uses on 3 distinct dates | 7 days | Within the window |

These are policy hypotheses, not validated fraud thresholds. `ProfileConfig` records the exact configuration in every run and in its analysis hash. Each evaluation froze its configuration before evaluating its held-out extract. The Phase 3 comparison requiring 20 purchase samples over 14 days is reported separately; it is not an alternate hidden production mode.

The amount baseline is the **lower median**, an observed integer amount (for an even sample count, the lower of the central two values). The lower median absolute deviation describes variability but adds no risk points. An amount at least 3 times the baseline gets 30 points; at least 6 times gets 45, subject to the merchant-range exception in `profiles-v2`. This simple ratio can flag legitimate occasional purchases and misses fraud resembling normal spending. The benchmarks demonstrate both limitations.

Category and country baselines contain values observed in the eligible population. Supported category aliases use their canonical category; otherwise the exact normalized source category is retained, including individual MCC values. Unknown categories do not all become `other` in profiling. Graph display categories retain their existing contract. Location analysis uses explicitly supplied customer-location country, never merchant geography. Automatic `ip_country` mapping was removed; it remains raw context unless explicitly mapped with appropriate source semantics. A specifically familiar location still respects its effective timestamp.

Only strictly earlier events can populate a baseline; same-time peers are excluded regardless of canonical ID ordering. When declared, source availability must be at or before the assessed event. Date-only observations become usable the next day. Window lower bounds are inclusive, and sample/span/freshness comparisons include their exact boundaries. Minimum windows are clamped at the supported year-1900 boundary.

Completed outgoing purchase/capture spending supplies observations. Pending, declined, failed and authorization-only records do not train spending profiles. Refunds/reversals are separate movements; they do not erase the original observed purchase amount or make it legitimate. Unresolved linked captures do not train profiles. Linked lifecycle eligibility is checked against prior available records, so a future or unavailable parent cannot validate an earlier baseline. Partial captures sharing an underlying transaction ID count as one sample, using their recognized total within the window; final capture completion is not inferred. Sparse or ambiguous capture data can therefore still be a poor purchase-amount reference.

Bills require `transaction_type=bill_payment`; recurrence is not inferred from MCC, similar amounts, merchant names or labels. Purchases cannot populate bill baselines, and one bill merchant cannot populate another's baseline. USD remains the only scored currency. Other currencies remain retained/accounted separately, without FX or a fabricated USD profile.

Insufficient count, insufficient span, stale history and missing current context are explicit unavailable states. A row-supplied baseline can be used as an explicitly **configured** fallback when historical evidence is inadequate. It is not described as learned or independently verified. Future rows cannot supply a fallback to earlier events. Existing projection consistency checks for supplied account baselines and legacy familiarity metadata still apply.

## Device observations, familiarity and trust

Repeated completed use can establish an observed familiarity pattern; it cannot establish trust. The record distinguishes total prior observations, completed uses, distinct dates and the familiarity source. Failed/declined attempts and rapid same-day repetition cannot satisfy the familiarity rule. Engine recommendations and fraud labels never determine which completed observations enter the profile; consequently anomalous activity can contaminate a baseline. This is an acknowledged limitation, not hidden feedback from an engine approval.

Optional CSV fields `device_trust_state` (`trusted`/`revoked`), `device_trust_effective_at`, and `device_trust_provenance` require a device ID and a complete assertion. Assertions only apply once observed/available and effective. The latest effective assertion wins; revocation wins equal-effective-time conflicts. Later trusted assertions can re-establish trust. Revocation overrides familiarity learned from repetition. Legacy `device_known_from` establishes configured familiarity, not verified trust. These are source assertions, not a device-verification service.

## Inspecting a result

Open **Datasets**, import/commit records and choose **Assess retained history**. Expand an assessed payment, then **Historical profile evidence**. Each signal exposes its population, source (historical/configured/observation/unavailable), sample count and requirements, window, sample dates, baseline, points, source record IDs and full evidence hash. Up to 50 IDs are shown with the full record count; sample count can be smaller when captures are grouped. Trust assertions identify their source record, effective date and provenance. The run revision identifies the retained record versions. Replay uses the saved per-event results and never updates profiles according to playback speed.

The existing source-availability mode remains a **single-cutoff snapshot**, not reconstruction of every original authorization decision. Profiles filter the versions selected in that snapshot; they do not retrieve a superseded version separately for each event time. A later correction can therefore remove an earlier version from a newly computed retrospective profile. Earlier frozen runs stay unchanged. Neither missing historical availability nor timezone assumptions become evidence of real-time knowledge.

An editable sandbox copy contains a static presentation projection, not the historical profile computation. A new sandbox simulation uses V1 configured baselines and can differ from the saved assessment. Use **Replay assessed purchases** to inspect the preserved historical scores.

## IBM / Erik Altman dataset

The local download contains 24,386,900 synthetic transaction rows (2,350,744,057 bytes). The author describes the virtual-world generator in [Synthesizing Credit Card Transactions](https://arxiv.org/abs/1910.03033); [IBM TabFormer](https://github.com/IBM/TabFormer) also provides the associated synthetic card data. The download is not evidence of real customers or confirmed real fraud.

`scripts/prepare_ibm_profiles.py` streams the full file and produces bounded CSVs in `training_data/phase3/`. Source files remain untouched. No full-file browser import or limit increase is introduced. Downloads and derived data stay ignored by version control; the reproducible manifest and aggregate evaluation reports are in `docs/simulator-evaluation/phase3/`.

- Development: users 0–3, January–June 2018, 2,696 records across 15 user/card instruments.
- Holdout: users 4–7, the same period, 2,159 records across 6 instruments. Accounts are disjoint.
- January–February supplies warm-up history; metrics cover March–June. Subsequent observations still update each account's baseline chronologically during evaluation.
- Selection is by predetermined user/date ranges, never fraud labels. Labels go into separate `*-labels.csv` files and are read only by the evaluation script after scoring.
- Source lacks authoritative event IDs: IDs are a non-label content hash plus duplicate occurrence. This is an evaluation adapter identity, not a banking identity scheme.
- Dollar amounts are treated as USD. Missing timezone is explicitly represented as a synthetic UTC clock convention, not verified UTC provenance. Missing source availability stays missing.
- A row without errors is treated as a completed purchase; errors become failed attempts. Negative amounts remain unclassified incoming adjustments without invented refund links. These are documented adapter assumptions, not source-verified lifecycle facts.
- User/card is an instrument-scoped account. Cards are never treated as devices. Merchant city/state is not a customer's location. User/card demographic files are not used to provide future-derived account information.

From the repository root in PowerShell:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
backend/.venv/Scripts/python.exe scripts/prepare_ibm_profiles.py
backend/.venv/Scripts/python.exe scripts/evaluate_ibm_profiles.py --compare --output docs/simulator-evaluation/phase3/development.json
backend/.venv/Scripts/python.exe scripts/evaluate_ibm_profiles.py --group holdout --output docs/simulator-evaluation/phase3/holdout.json
```

The CSVs `training_data/phase3/development.csv` and `holdout.csv` can be imported through **Datasets**. Do not import the separate labels as transactions. See the [evaluation report](simulator-evaluation/phase3/report.md) for the unfavorable detection results and their limits.

## Verification and measured cost

Phase 3 passed 183 backend tests, 172 frontend unit tests and 25 browser scenarios, plus static/build/contract checks. A deliberate corrupted-median negative control failed the independent arithmetic test as intended. The 2,696-row development extract also passed retained preview, commit, assessment and reopening in an isolated database. Its serialized saved run is about 36.29 MiB: retaining explicit snapshots and evidence favors auditability over compact storage. Existing application limits remain in force; larger-scale performance and compact evidence storage are future work.
