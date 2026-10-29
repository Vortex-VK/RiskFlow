import type { StackExplanation } from "../api/stackExplanation";
import type { ComparativeCheck } from "../api/stackComparison";
import { merchantCategoryName } from "./merchantCategories";

export const rankingLabels: Record<string, string> = {
  log_amount: "Purchase amount",
  category: "Merchant type",
  channel: "Payment method",
  hour: "Time of day",
  weekday: "Day of week",
  completed: "Completion status",
  history_count: "Earlier purchases",
  history_days: "Available history",
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
  channel_frequency: "Payment method history",
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
  expert_v2: "Basic payment check",
  expert_rich: "Payment details",
  expert_relative: "Spending comparisons",
  expert_pooled: "Broader payment patterns",
  expert_ibm_expert: "Card payment patterns",
  expert_household_expert: "Spending patterns",
  expert_sparkov_expert: "Purchase patterns",
  expert_handbook_expert: "Payment history",
  p_log_history_n: "Account payment history",
  p_log_std100: "Amount variation",
  p_log_ratio10: "Amount vs recent purchases",
  p_log_ratio100: "Amount vs earlier purchases",
  p_z10: "Recent amount deviation",
  p_z100: "Historical amount deviation",
  p_log_gap_ratio: "Time since previous payment",
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
  p_channel_frequency: "Payment method history",
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
  if (feature === "category" && value !== null) {
    const name = merchantCategoryName(value);
    if (name) return name;
    if (/^\d{4}$/.test(String(value))) return `Category code ${value}`;
  }
  if (typeof value === "string") {
    if (value === "__MISSING__") return "Not supplied";
    return feature === "channel" ? value.replace(/ Transaction$/, "") : value;
  }
  if (value === null)
    return feature === "p_log_gap_ratio"
      ? "Too little history"
      : "Not available";
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
    return earlierPurchases(Math.round(Math.expm1(value)));
  if (feature === "log_gap_hours")
    return `${Math.expm1(value).toFixed(1)} hours`;
  if (["history_count", "geo_history_count"].includes(feature))
    return earlierPurchases(Math.round(value));
  if (feature === "merchant_seen")
    return value ? "Previously visited" : "No earlier visit";
  if (feature === "history_days") return `${value.toFixed(1)} days`;
  if (feature === "hour")
    return `${String(value).padStart(2, "0")}:00–${String(value).padStart(2, "0")}:59 UTC`;
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
    return `Scored above ${(100 / (1 + Math.exp(-value))).toFixed(1)}% of reference payments`;
  if (["p_log_ratio10", "p_log_ratio100"].includes(feature))
    return `${Math.exp(value).toFixed(1)}× the usual amount`;
  if (feature === "p_log_gap_ratio")
    return `${Math.exp(value).toFixed(1)}× the usual gap`;
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

function earlierPurchases(count: number) {
  return `${count} earlier ${count === 1 ? "purchase" : "purchases"}`;
}

// Describe the selected account directly. The comparison payment is a score
// reference, not a typical value for each of its features.
export function rankingFact(
  feature: string,
  value: string | number | null,
  historyCount?: number,
) {
  if (["p_channel_frequency", "channel_frequency"].includes(feature)) {
    if (historyCount === 0)
      return { value: "No earlier payments", context: "for this account" };
    if (typeof value === "number")
      return {
        value: `${(value * 100).toFixed(1)}%`,
        context: "of earlier payments used this payment method",
      };
  }
  if (feature === "p_log_gap_ratio") {
    if (typeof value !== "number")
      return {
        value: "Too little history",
        context: "to compare time between payments",
      };
    const ratio = Math.exp(value);
    const change = Math.abs(ratio - 1) * 100;
    return {
      value:
        change < 0.05
          ? "About the usual wait"
          : `${change.toLocaleString(undefined, { maximumFractionDigits: 1 })}% ${ratio > 1 ? "longer" : "shorter"}`,
      context:
        change < 0.05
          ? "between this account’s payments"
          : "than this account’s usual wait between payments",
    };
  }
  if (feature === "p_log_history_n" && typeof value === "number") {
    const n = Math.round(Math.expm1(value));
    return {
      value: `${n.toLocaleString()} earlier ${n === 1 ? "payment" : "payments"}`,
      context: "from this account",
    };
  }
  return { value: observedRanking(feature, value), context: "" };
}

// A fixed affine scale for the frozen model: its baseline is zero, and one
// raw score unit is ten points. No upload-dependent scaling or clipping.
export function priorityPoints(rawMargin: number, baseValue: number) {
  return (rawMargin - baseValue) * 10;
}

// Values in the walkthrough are integer tenths, so the displayed arithmetic
// reconciles exactly. Rounding cumulative endpoints avoids an invented residual.
export function formatPoints(tenths: number, signed = false) {
  return `${signed && tenths > 0 ? "+" : ""}${(tenths / 10).toFixed(1)}`;
}

// Exact grouped head-attribution differences use the same units as the parent.
// Align rounded endpoints with the waterfall to reconcile every displayed tenth.
export function checkPointBreakdown(
  check: ComparativeCheck,
  step: { from: number; to: number },
) {
  let cumulative = 0;
  let previous = step.from;
  const rows = check.observations.map((row, i) => {
    cumulative += row.contribution;
    const current =
      i === check.observations.length - 1
        ? step.to
        : Math.round(step.from + cumulative * 100);
    const points = current - previous;
    previous = current;
    return { ...row, points };
  });
  return { rows, total: step.to - step.from };
}

export function priorityComparison(
  data: StackExplanation,
  reference: StackExplanation,
) {
  if (
    data.modelBundleSha256 !== reference.modelBundleSha256 ||
    Math.abs(data.baseValue - reference.baseValue) > 1e-7
  )
    throw new Error("These payments do not share the same scoring baseline.");
  const referenceRows = new Map(
    reference.contributions.map((r) => [r.feature, r]),
  );
  if (referenceRows.size !== data.contributions.length)
    throw new Error("The comparison is missing scoring inputs.");
  const ordered = data.contributions
    .map((row) => {
      const other = referenceRows.get(row.feature);
      if (!other) throw new Error("The comparison is missing scoring inputs.");
      return {
        ...row,
        referenceValue: other.value,
        contribution: row.contribution - other.contribution,
      };
    })
    .sort(
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
      referenceValue: null,
      contribution: remaining.reduce((s, r) => s + r.contribution, 0),
    },
  ];
  // Center this upload on its middle payment. Scale stays fixed at ten points
  // per raw-score unit; zero moves with the benchmark, never with capacity.
  const start = 0;
  const final = Math.round((data.rawMargin - reference.rawMargin) * 100);
  let score = 0;
  let previous = start;
  const steps = rows.map((row, i) => {
    const from = previous;
    score += row.contribution;
    const to = i === rows.length - 1 ? final : Math.round(score * 100);
    previous = to;
    return { ...row, from, to, difference: to - from };
  });
  // The remainder contains different head inputs, not copies of the four
  // visible checks. Give it its own complete, rounded breakdown.
  const remainderStart = steps.at(-1)!.from;
  let remainderRaw = 0;
  let remainderPrevious = remainderStart;
  const remainingSteps = remaining.map((row, i) => {
    const from = remainderPrevious;
    remainderRaw += row.contribution;
    const to =
      i === remaining.length - 1
        ? final
        : Math.round(remainderStart + remainderRaw * 100);
    remainderPrevious = to;
    return { ...row, from, to, difference: to - from };
  });
  return {
    start,
    final,
    difference: final - start,
    steps,
    remainingSteps,
  };
}
