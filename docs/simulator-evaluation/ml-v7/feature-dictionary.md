# Added features

All variants retain the same 30 soft-history baseline features. `cb_context` adds the existing nine account-sequence and eight shared-merchant features from v4. `cb_geo` adds the following seven features; no merchant identifier, ZIP category, personal snapshot or card number is passed directly to a model.

| Feature | Meaning |
| --- | --- |
| `merchant_geo_available` | A non-online purchase supplies merchant state and city. This is not customer location. |
| `geo_history_count` | Prior positive purchase attempts with usable merchant geography in the previous 90 days, same instrument account. |
| `state_frequency_90d` | Fraction of that history matching current merchant state. |
| `city_frequency_90d` | Fraction matching current state and city. |
| `zip_frequency_90d` | Fraction matching current state and ZIP; missing when current ZIP is absent. |
| `distinct_states_90d` | Distinct merchant states in supported prior history. |
| `state_recency_days` | Days since the most recent prior attempt in the current merchant state within the window; missing if unseen. |

Window lower bounds are inclusive. All equal-time rows are evaluated before any update. Missing/online geography does not update geographic history; no history produces missing frequencies. Histories are account-specific and include prior attempts, not inferred completed flows. Prior geographic attempts are assumed available immediately under the source's existing synthetic timing convention.

`cb_feedback` additionally receives:

| Feature | Meaning |
| --- | --- |
| `merchant_matured_count` | Fit-role positive purchase attempts at this merchant in the 90 days preceding the delayed cutoff. |
| `merchant_matured_fraud` | Finalized synthetic fraud labels among those attempts, assumed known only after the reporting delay. |
| `merchant_matured_rate` | `(merchant_frauds + 20 * global_rate) / (merchant_count + 20)`, where `global_rate` uses the same delayed fit-role window. |

The main delay is 30 days. Both the current target and events exactly at its delayed cutoff are excluded. Rates for unseen merchants fall back to the corresponding global rate. Empty global history produces zero with zero support. Fourteen- and sixty-day scoring sensitivity reuse the same trained feedback model and cutoff; these alternatives are not independently tuned models. Calibration and evaluation-user labels never enter this feedback history.
