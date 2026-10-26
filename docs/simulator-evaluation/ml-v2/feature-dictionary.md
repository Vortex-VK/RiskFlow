# Gradual history features v2

The sixteen standard features and thirty hard-fallback features retain the exact [v1 definitions](../ml-v1/feature-dictionary.md). Soft models receive the same sixteen standard features, twelve adaptive measurements below, and the original activity/spend ratios: thirty measurements total. All underlying measurements are cached as float32, but historical accumulation uses double precision. IDs, raw merchant identities, labels and current status/errors are not predictors.

All reference observations are positive completed purchases on the same source-scoped user/card account, strictly before the target time and available by that time. The lower 90-day boundary is inclusive. Equal-time targets share preceding state. Failed prior attempts still affect standard attempt counts, but not completed amount statistics. Exact percentile/median structures and attempted/completed definitions remain unchanged for the hard baseline.

For a prior amount in integer USD cents, let `x = log(1 + amount)` and `w = 2^(-age_days / 30)`. Maintain total mass, weighted first moment and weighted second moment within 90 days. Advance these sums by decay between observation times and subtract expired observations; late arrivals enter only when available, already discounted for their event age. There is no repeated full-history scan per target.

| Measurement | Definition |
| --- | --- |
| `ew_account_log_mean`, `ew_account_log_std` | Weighted mean and population standard deviation of log completed amounts. Missing with no account observations. |
| `ew_account_support` | Sum of decayed account weights; zero with no history. It is an evidence-strength feature, not an independent-sample-count claim. |
| `ew_category_support` | Corresponding mass for the current MCC. |
| `category_shrink_weight` | Category mass divided by `(category mass + 8)`. Zero for unseen categories; rises gradually with supported recent observations. |
| `shrunk_category_log_mean` | Weighted mixture of category mean and account mean using the shrink weight. Missing when account history is empty. |
| `shrunk_log_amount_z` | Current log amount minus the mixture mean, divided by `max(0.1, mixture standard deviation)`. Mixture variance includes both within-population variance and between-mean displacement. |
| `account_log_amount_z` | Current log amount minus account mean, divided by `max(0.1, account standard deviation)`. |
| `recent_log_mean_shift` | Log of the arithmetic mean completed amount over seven days minus the 90-day decayed log-amount mean. Missing when the short reference is empty. These are intentionally different summaries of short and longer behavior. |
| `merchant_frequency_soft`, `category_frequency_soft`, `channel_frequency_soft` | Matching completed count divided by all completed count in 90 days, available from one observation. Missing for no history; zero for a supported but unseen value. |

Soft statistics can exist with one observation; evidence mass and ordinary history count/span/age tell the model how weak that reference is. This deliberately replaces the hard ten-observation category switch. The 30-day half-life, eight-unit prior mass and 0.1 log-standard-deviation floor are fixed hypotheses, not guarantees of improved discrimination or calibrated uncertainty. The account reference includes its category observations; the mixture is a regularized feature construction, not a claimed independent Bayesian posterior.

Numerical missingness follows each model's training-fitted or native representation. Categorical unknowns follow the frozen preprocessing; no test vocabulary fitting is performed. Support recipes retain source account, cutoff, window, effective masses and shrink weight. Explanation contributions must reconstruct the estimator's raw score; they are associations learned from synthetic labels, not causal statements.
