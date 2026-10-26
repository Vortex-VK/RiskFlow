# V4 context measurements

The baseline retains the thirty [v2 soft-history features](../ml-v2/feature-dictionary.md), with exactly the same historical definitions. V4 adds nine sequence features and eight merchant features. None uses the target outcome, current errors/completion status, a raw merchant ID as a predictor or label-derived merchant reputation. Existing attempt/completed eligibility remains unchanged.

Reference attempts must have positive amounts, precede the target timestamp strictly and be available by that time. Window lower boundaries are inclusive. Equal-time targets cannot observe each other, even across accounts. Late arrivals enter only when available and expire by event time. Input requires globally chronological ordering. When multiple preceding attempts share the latest timestamp but disagree on merchant, channel or completed amount, the corresponding predecessor measurement is missing rather than resolved by arbitrary ID order.

| Feature | Definition |
| --- | --- |
| `attempts_5m` | Account's preceding positive attempts in five minutes |
| `same_merchant_attempts_5m` | Those attempts at the target merchant |
| `distinct_merchants_1h`, `distinct_categories_1h` | Distinct merchants/MCCs among the account's preceding one-hour attempts |
| `prior_failure_fraction_1h` | Failed attempts divided by attempts in the account's previous hour; missing with no attempts |
| `last_channel_changed`, `last_merchant_changed` | Whether the target differs from the latest preceding attempt within 90 days; missing if absent or ambiguous |
| `log_amount_over_previous_completed` | `log1p(current cents) - log1p(latest preceding completed cents)` within 90 days; missing if absent or ambiguous |
| `hour_frequency_90d` | Fraction of preceding completed purchases in 90 days occurring at the target hour, using the source's synthetic UTC convention; missing with no completed history |
| `merchant_attempts_1h`, `merchant_attempts_7d` | Preceding attempts at this merchant across the observed account population |
| `merchant_distinct_accounts_1h`, `merchant_distinct_accounts_7d` | Distinct source-scoped card accounts in those windows; not an inferred count of devices or people |
| `merchant_failure_fraction_1h` | Failed attempts divided by attempts at that merchant in the preceding hour; missing without attempts |
| `merchant_rate_ratio` | `(hour_count + 1) / ((week_count - hour_count) / 167 + 1)`; a smoothed activity comparison, not a calibrated anomaly probability |
| `merchant_log_amount_z_7d` | Current log-cent amount minus the merchant's prior completed log-amount mean, divided by `max(0.1, population standard deviation)`; missing without completed history |
| `merchant_account_novel_7d` | Target account has not appeared in the merchant's preceding week; missing if the merchant has no preceding attempts |

All features are numeric and stored as float32, with double-precision accumulations. Missing numeric values follow each estimator's existing representation. Histories are built before supervised sampling, so retaining all frauds cannot alter the history seen by a purchase. Shared context includes only unlabelled observed past attempts from all roles; supervised fitting still excludes validation and reserved users.

Sequence features require the account's history. Merchant features require the broader observed transaction feed. An isolated account upload cannot be assumed to reproduce population-wide merchant measurements. This is a research input contract; runtime delivery must explicitly supply or reject the required context. No user location, impossible-travel claim, inferred device identity or money-flow relationship is manufactured from merchant data.
