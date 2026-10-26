# Purchase feature dictionary v1

Frozen for the first reserved prediction run. This documents the implemented measurements; the source code and dependency lock are hashed in `predictions.json`. Research features are float32, categorical values are strings, and model outputs are float64. Amounts are integer US cents throughout. The log transform is natural `log(1 + value)`.

Only positive standalone purchase attempts are target rows. Zero amounts and negative adjustments remain in source accounting. Identity, user/card IDs, raw merchant ID, fraud label, current error/status, and source row number are never predictors. Prior completed spending uses the IBM adapter assumption that a previous row with empty `Errors?` completed at its recorded time. This is retrospective synthetic analysis, not reconstruction of bank authorization availability.

Every history window includes its lower boundary and excludes the target timestamp: `[T-window, T)`. Observations also need availability at or before T. Equal-time targets are all measured before their batch updates history. Cards are scoped within source user and USD currency. There is no shared merchant population in this experiment.

## Standard features (16)

| Names | Definition and missingness |
| --- | --- |
| `log_amount` | Log of current positive amount in cents. |
| `category`, `channel` | Exact `MCC <code>` and IBM `Use Chip` strings. Empty channel has an explicit missing token in the builder; missing-channel runtime input is outside this experiment's contract. |
| `hour`, `weekday` | Hour 0–23 and Monday=0 weekday from the source minute clock, using a declared synthetic UTC convention. Actual timezone is unknown. |
| `attempts_1h`, `attempts_24h`, `attempts_7d` | Counts of previous positive attempts, including failed attempts. Empty windows equal zero. |
| `log_spend_24h`, `log_spend_7d` | Log of previous completed positive spending in cents. Empty windows equal zero. |
| `log_mean_24h`, `log_mean_7d` | Log of arithmetic mean completed positive amount. Empty windows are missing. |
| `merchant_recency_days` | Days since latest completed purchase at this merchant within 90 days; missing if none. Merchant ID is a history lookup key only. |
| `history_samples` | Count of previous completed positive purchases in 90 days, including zero for no history. |
| `history_span_days` | Latest minus earliest completed timestamp in the 90-day window, divided by 86,400; missing with no observations. This is observed span, not assumed complete coverage. |
| `history_age_days` | Target minus latest completed timestamp, in days; missing with no observations. |

## Additional personalized features (14)

The account reference requires at least ten completed positive purchases in 90 days and a latest observation at most 30 days old. The category reference has the same requirements within the current MCC; otherwise it falls back to the supported account reference. If neither is supported, derived measurements are missing. Unlike the existing rules, these model statistics do not impose a seven-day minimum span; actual span is a separate feature.

| Names | Definition and missingness |
| --- | --- |
| `amount_percentile`, `category_amount_percentile` | Fraction of reference amounts less than or equal to current amount, including ties. Missing without supported reference. |
| `robust_amount_deviation`, `category_robust_deviation` | `(amount - median) / max(1 cent, Q75 - Q25)`. Quantile q is sorted amount at zero-based index `floor((n-1)*q)`, including the lower median for even n. |
| `category_fallback` | 1 when category support is insufficient, even if the fallback account is also unavailable; otherwise 0. |
| `category_samples` | Actual count of completed positive purchases in this MCC within 90 days, before fallback. |
| `category_frequency`, `channel_frequency`, `merchant_frequency` | Matching completed observations divided by account count in 90 days; missing without supported account reference. A supported but unseen value has frequency zero. |
| `activity_ratio` | Attempts in last 24h divided by `(attempts in preceding six days / 6 + 1)`. Missing if preceding-six-day count is zero. |
| `spend_ratio` | Completed cents in last 24h divided by `(completed cents in preceding six days / 6 + 1 cent)`. Missing if preceding-six-day spending is zero. |
| `log_account_median`, `log_category_median` | Log of supported reference median cents; category uses the explicit fallback. |
| `personal_history_available` | 1 for a supported account reference, otherwise 0. |

## Encoding and evidence

Logistic regression receives only the standard features. Its training-fitted numerical pipeline imputes medians, retains missing indicators for columns missing during fitting, and scales them; its categorical encoder ignores unseen values rather than fitting a new vocabulary. CatBoost receives numerical NaNs and categorical strings. EBM receives continuous numerical features with native missing bins and nominal categorical features with its unknown-value path. Only development fitting rows define these transformations.

The feature builder returns a compact support recipe: account, cutoff, 90-day window, source population, sample counts, category/account/unavailable reference, minimum support, freshness, and feature version. The offline cache stores values and stable identities. This is sufficient to reproduce measurements against the immutable extract; it is not a shipped interactive evidence browser. Runtime evidence persistence and presentation remain conditional on the promotion gate.

The existing rules retain their own published profile and equal-time velocity semantics. The offline R0 implementation is checked against the actual retained engine; its definitions are not silently replaced with the learned definitions above.
