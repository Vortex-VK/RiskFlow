// Names describe measured inputs. Direction comes from SHAP, never from these labels.
export const featureLabels: Record<string, string> = {
  log_amount: "Payment amount",
  category: "Merchant category",
  channel: "Payment channel",
  hour: "Hour of payment (UTC)",
  weekday: "Day of week",
  attempts_1h: "Account attempts in the past hour",
  attempts_24h: "Account attempts in the past day",
  attempts_7d: "Account attempts in the past week",
  log_spend_24h: "Account spending in the past day",
  log_spend_7d: "Account spending in the past week",
  log_mean_24h: "Average payment in the past day",
  log_mean_7d: "Average payment in the past week",
  merchant_recency_days: "Time since this merchant was used",
  history_samples: "Completed purchase history",
  history_span_days: "Length of purchase history",
  history_age_days: "Age of purchase history",
  amount_percentile: "Amount rank in account history",
  robust_amount_deviation: "Amount compared with typical account spending",
  category_amount_percentile: "Amount rank within this category",
  category_robust_deviation: "Amount compared with category spending",
  category_fallback: "Use of account history for category estimates",
  category_samples: "Purchases in this category",
  category_frequency: "How often this category is used",
  channel_frequency: "How often this channel is used",
  merchant_frequency: "How often this merchant is used",
  activity_ratio: "Recent activity compared with usual activity",
  spend_ratio: "Recent spending compared with usual spending",
  log_account_median: "Typical account payment",
  log_category_median: "Typical category payment",
  personal_history_available: "Availability of personal history",
  ew_account_log_mean: "Recent typical account amount",
  ew_account_log_std: "Variation in recent amounts",
  ew_account_support: "Weight of recent account history",
  ew_category_support: "Weight of recent category history",
  category_shrink_weight: "Reliance on category history",
  shrunk_log_amount_z: "Amount relative to blended spending history",
  account_log_amount_z: "Amount relative to recent account history",
  shrunk_category_log_mean: "Blended typical category amount",
  recent_log_mean_shift: "Change in typical spending",
  merchant_frequency_soft: "Merchant familiarity",
  category_frequency_soft: "Category familiarity",
  channel_frequency_soft: "Channel familiarity",
  attempts_5m: "Account attempts in the past 5 minutes",
  same_merchant_attempts_5m: "Repeat merchant attempts in 5 minutes",
  distinct_merchants_1h: "Different merchants used in the past hour",
  distinct_categories_1h: "Different categories used in the past hour",
  prior_failure_fraction_1h: "Failed attempts in the past hour",
  last_channel_changed: "Change of payment channel",
  last_merchant_changed: "Change of merchant",
  log_amount_over_previous_completed:
    "Amount relative to the previous purchase",
  hour_frequency_90d: "Familiarity with this time of day",
  merchant_attempts_1h: "Merchant traffic in the past hour",
  merchant_attempts_7d: "Merchant traffic in the past week",
  merchant_distinct_accounts_1h: "Accounts at this merchant in the past hour",
  merchant_distinct_accounts_7d: "Accounts at this merchant in the past week",
  merchant_failure_fraction_1h: "Merchant failure rate in the past hour",
  merchant_rate_ratio: "Change in merchant activity",
  merchant_log_amount_z_7d: "Amount relative to merchant history",
  merchant_account_novel_7d: "New account at this merchant",
  merchant_geo_available: "Availability of merchant geography",
  geo_history_count: "Geographic history available",
  state_frequency_90d: "Familiarity with merchant state",
  city_frequency_90d: "Familiarity with merchant city",
  zip_frequency_90d: "Familiarity with merchant ZIP code",
  distinct_states_90d: "Different states in account history",
  state_recency_days: "Time since this state was visited",
  minutes_since_previous: "Time since the previous attempt",
  minutes_since_previous_location: "Time since the previous location",
  previous_state_changed: "Change of state",
  previous_city_changed: "Change of city",
  location_seen_before: "Previously visited location",
  minutes_since_location_seen: "Time since this location was visited",
  distinct_locations_24h: "Different locations in the past day",
  location_attempts_1h: "Attempts at this location in the past hour",
  current_completed: "Payment completion status",
  v8_margin: "Earlier fraud detector assessment",
  pattern_margin: "Card behavior detector signal",
  priority_margin: "Card review priority signal",
};

const booleanFeatures = new Set([
  "category_fallback",
  "personal_history_available",
  "last_channel_changed",
  "last_merchant_changed",
  "merchant_account_novel_7d",
  "merchant_geo_available",
  "previous_state_changed",
  "previous_city_changed",
  "location_seen_before",
  "current_completed",
]);

export function observedFeature(
  feature: string,
  value: string | number | null,
): string | null {
  if (value === null)
    return "Unavailable; the model’s missing-value behavior contributes here.";
  if (booleanFeatures.has(feature))
    return `Observed: ${value === 1 ? "yes" : "no"}`;
  if (typeof value === "string") return value;
  if (["v8_margin", "pattern_margin", "priority_margin"].includes(feature))
    return "Combined detector output; its underlying factors are not separated here.";
  if (
    /^log_(amount|spend_24h|spend_7d|mean_24h|mean_7d|account_median|category_median)$/.test(
      feature,
    )
  )
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(Math.expm1(value) / 100);
  if (feature === "hour") return `${value}:00–${value}:59 UTC`;
  if (feature === "weekday")
    return (
      [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ][value] ?? null
    );
  if (
    /percentile|fraction|^(category|channel|merchant)_frequency$/.test(
      feature,
    ) &&
    value >= 0 &&
    value <= 1
  )
    return `${(value * 100).toFixed(1)}% of available history`;
  if (feature.startsWith("minutes_since_"))
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} minutes`;
  if (feature.endsWith("_days"))
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
  if (
    /attempts|distinct_|history_samples|category_samples|geo_history_count/.test(
      feature,
    )
  )
    return `${value.toLocaleString()} observed`;
  return null;
}
