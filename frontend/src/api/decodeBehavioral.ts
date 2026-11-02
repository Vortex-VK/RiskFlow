import { identifier, integer, list, object, timestamp } from "./decode";
import type { components } from "./generated";

export function decodeBehavioral(
  value: unknown,
): components["schemas"]["BehavioralEvidence"] {
  const data = object(
    value,
    [
      "version",
      "analysisKind",
      "occurredAt",
      "observedAmount",
      "historyCount",
      "horizonDays",
      "medianAmount",
      "amountRatio",
      "prior24HCount",
      "currency",
      "timePrecision",
      "evidenceIds",
      "evidenceTruncated",
      "merchantIdentityAvailable",
    ],
    "behavioral evidence",
  );
  integer(data.historyCount, 0, 20000, "history count");
  timestamp(data.occurredAt);
  integer(data.prior24HCount, 0, data.historyCount, "prior day count");
  const ids = list(data.evidenceIds, 8, "evidence IDs");
  ids.forEach(identifier);
  if (
    data.version !== "behavioral-features-v1" ||
    data.analysisKind !== "descriptive" ||
    data.horizonDays !== 30 ||
    data.currency !== "USD" ||
    typeof data.observedAmount !== "string" ||
    !/^\d+(\.\d+)?$/.test(data.observedAmount) ||
    !Number.isFinite(Number(data.observedAmount)) ||
    Number(data.observedAmount) <= 0 ||
    !["instant", "date"].includes(String(data.timePrecision)) ||
    typeof data.evidenceTruncated !== "boolean" ||
    typeof data.merchantIdentityAvailable !== "boolean" ||
    new Set(ids).size !== ids.length ||
    ids.length !== Math.min(8, data.historyCount) ||
    data.evidenceTruncated !== data.historyCount > 8 ||
    (data.historyCount === 0
      ? data.medianAmount !== null || data.amountRatio !== null
      : typeof data.medianAmount !== "string" ||
        !/^\d+(\.\d+)?$/.test(data.medianAmount) ||
        !Number.isFinite(Number(data.medianAmount)) ||
        Number(data.medianAmount) <= 0 ||
        typeof data.amountRatio !== "number" ||
        !Number.isFinite(data.amountRatio) ||
        data.amountRatio < 0)
  )
    throw new Error(
      "Invalid behavioral observations. Reload the saved result.",
    );
  return data as components["schemas"]["BehavioralEvidence"];
}
