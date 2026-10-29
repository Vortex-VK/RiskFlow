import type { StackExplanation } from "../api/stackExplanation";

export const rankingLabels: Record<string, string> = {
  log_amount: "Purchase amount",
  category: "Category",
  channel: "Payment channel",
  hour: "Hour of day",
  weekday: "Day of week",
  completed: "Completion status",
  history_count: "Earlier purchases",
  history_days: "History length",
  log_mean: "Typical earlier amount",
  log_std: "Amount variation",
  amount_z: "Amount deviation",
  amount_rank: "Amount within account history",
  merchant_frequency: "Share at this merchant",
  merchant_seen: "Previous merchant visits",
  log_attempts_1d: "Earlier purchases in 24 hours",
  log_attempts_7d: "Earlier purchases in 7 days",
  log_attempts_1h: "Earlier purchases in 1 hour",
  log_attempts_30d: "Earlier purchases in 30 days",
  log_spend_7d: "Earlier spending in 7 days",
  log_gap_hours: "Time since previous purchase",
  recent_category_frequency: "Category frequency",
  channel_frequency: "Channel frequency",
  hour_frequency: "Hour frequency",
  weekday_frequency: "Weekday frequency",
  recent_failure_fraction: "Previous failed attempts",
  unique_merchants_1d: "Merchants in 24 hours",
  same_amount_1d: "Same-amount purchases in 24 hours",
  spend_acceleration: "Spending change",
  amount_change: "Amount change",
  category_amount_z: "Amount vs category history",
  merchant_log_count_7d: "Merchant purchases in 7 days",
  merchant_unique_accounts_7d: "Merchant accounts in 7 days",
  merchant_amount_z: "Amount vs merchant history",
  merchant_new_account: "Account new to merchant",
  merchant_volume_acceleration: "Merchant activity change",
  date_only: "Date-only input",
  amount_z_7d: "Amount vs previous week",
  new_category: "Category history",
  geo_history_count: "Earlier purchases with geography",
  geo_region_frequency: "Region frequency",
  geo_city_frequency: "City frequency",
  geo_new_region: "New region",
  geo_new_city: "New city",
  geo_region_change: "Region changed",
  geo_regions_1d: "Regions in 24 hours",
  geo_available: "Geography supplied",
  expert_v2: "Core transaction assessment",
  expert_rich: "Detailed-context assessment",
  expert_relative: "Relative-pattern assessment",
  expert_pooled: "Multi-source assessment",
  expert_ibm_expert: "Card-pattern assessment",
  expert_household_expert: "Household-pattern assessment",
  expert_sparkov_expert: "Purchase-pattern assessment",
  expert_handbook_expert: "Transaction-history assessment",
  p_log_history_n: "Available account history",
  p_log_std100: "Amount variation",
  p_log_ratio10: "Amount vs recent purchases",
  p_log_ratio100: "Amount vs earlier purchases",
  p_z10: "Recent amount deviation",
  p_z100: "Historical amount deviation",
  p_log_gap_ratio: "Time between purchases",
  p_log_count1h: "Purchases in the previous hour",
  p_log_count1d: "Purchases in the previous day",
  p_log_count7d: "Purchases in the previous week",
  p_counterparty_known: "Merchant supplied",
  p_counterparty_seen: "Merchant history",
  p_counterparty_frequency: "Share at this merchant",
  p_log_distinct_counterparties: "Merchant variety",
  p_log_counterparty_n: "Merchant's prior purchases",
  p_log_counterparty_distinct_accounts: "Merchant's prior accounts",
  p_counterparty_amount_z: "Amount vs merchant history",
  p_account_new_to_counterparty: "Account's merchant history",
  p_hour_sin: "Time of day",
  p_hour_cos: "Time of day",
  p_weekday_sin: "Day of week",
  p_weekday_cos: "Day of week",
  p_category_known: "Category supplied",
  p_category_frequency: "Category frequency",
  p_new_category: "Category history",
  p_channel_known: "Channel supplied",
  p_channel_frequency: "Channel frequency",
  p_region_known: "Region supplied",
  p_region_frequency: "Region frequency",
  p_new_region: "Region history",
  p_city_known: "City supplied",
  p_city_frequency: "City frequency",
  p_new_city: "City history",
};

export function observedRanking(
  feature: string,
  value: string | number | null,
) {
  if (typeof value === "string")
    return value === "__MISSING__" ? "Not supplied" : value;
  if (value === null) return "Not available";
  if (["log_amount", "log_mean", "log_spend_7d"].includes(feature))
    return `$${Math.expm1(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (
    [
      "log_attempts_1h",
      "log_attempts_1d",
      "log_attempts_7d",
      "log_attempts_30d",
      "merchant_log_count_7d",
    ].includes(feature)
  )
    return `${Math.round(Math.expm1(value))} earlier purchases`;
  if (feature === "log_gap_hours")
    return `${Math.expm1(value).toFixed(1)} hours`;
  if (["history_count", "geo_history_count"].includes(feature))
    return `${Math.round(value)} earlier purchases`;
  if (feature === "merchant_seen")
    return value ? "Previously visited" : "No earlier visit";
  if (feature === "history_days") return `${value.toFixed(1)} days`;
  if (feature === "hour")
    return `${String(value).padStart(2, "0")}:00 UTC hour`;
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
      ][value] ?? "Unknown day"
    );
  if (feature === "completed") return value ? "Completed" : "Not completed";
  if (feature === "amount_rank" || feature === "recent_failure_fraction")
    return `${(value * 100).toFixed(1)}% of earlier purchases`;
  if (feature.includes("_z") || ["p_z10", "p_z100"].includes(feature))
    return `${Math.abs(value).toFixed(1)} deviations ${value >= 0 ? "above" : "below"} the prior log-amount baseline`;
  if (feature.startsWith("expert_"))
    return `Reference percentile ${(100 / (1 + Math.exp(-value))).toFixed(1)}`;
  if (["p_log_ratio10", "p_log_ratio100"].includes(feature))
    return `${Math.exp(value).toFixed(1)}× the prior geometric mean amount`;
  if (feature === "p_log_gap_ratio")
    return `${Math.exp(value).toFixed(1)}× the usual interval`;
  if (feature.endsWith("frequency"))
    return `${(value * 100).toFixed(1)}% of prior observations`;
  if (
    [
      "p_log_history_n",
      "p_log_count1h",
      "p_log_count1d",
      "p_log_count7d",
      "p_log_distinct_counterparties",
      "p_log_counterparty_n",
      "p_log_counterparty_distinct_accounts",
    ].includes(feature)
  )
    return `${Math.round(Math.expm1(value))} earlier observations`;
  if (feature.endsWith("known")) return value ? "Supplied" : "Not supplied";
  if (feature === "p_counterparty_seen")
    return value ? "Previously visited" : "No earlier visit";
  if (
    feature.startsWith("p_new_") ||
    feature === "p_account_new_to_counterparty"
  )
    return value ? "No earlier occurrence" : "Previously observed";
  return "Measured from the supplied transaction history";
}

export function rankingWalkthrough(
  data: StackExplanation,
  rankAt: (score: number) => number,
) {
  const ordered = [...data.contributions].sort(
    (a, b) =>
      Math.abs(b.contribution) - Math.abs(a.contribution) ||
      a.feature.localeCompare(b.feature),
  );
  const visible = ordered.slice(0, 4);
  const remaining = ordered.slice(4);
  const rows = [
    ...visible,
    {
      feature: "other",
      value: null,
      contribution: remaining.reduce((s, r) => s + r.contribution, 0),
    },
  ];
  let score = data.baseValue;
  const steps = rows.map((row, i) => {
    const from = rankAt(score);
    score = i === rows.length - 1 ? data.rawMargin : score + row.contribution;
    const to = rankAt(score);
    return { ...row, from, to, movement: from - to };
  });
  return {
    start: rankAt(data.baseValue),
    final: rankAt(data.rawMargin),
    steps,
  };
}
