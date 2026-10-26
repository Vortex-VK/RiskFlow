import { identifier, integer, list, object, text, timestamp } from "./decode";

export function decodeMerchantRange(
  value: unknown,
  context: {
    eventId: string;
    windowStart: string;
    evaluatedAt: string;
    freshnessDays: number;
    sampleCount: number;
    evidenceCount: number;
  },
): number {
  const range = object(
    value,
    [
      "merchantId",
      "category",
      "sampleCount",
      "distinctDays",
      "firstObservedAt",
      "lastObservedAt",
      "maximumMinor",
      "evidenceIds",
      "evidenceCount",
      "evidenceHash",
    ],
    "merchant amount range",
  );
  const fail = () => {
    throw new Error("Invalid merchant amount evidence.");
  };
  text(range.merchantId, "merchant identifier", 200);
  text(range.category, "merchant category", 200);
  integer(range.sampleCount, 3, context.sampleCount, "merchant samples");
  integer(
    range.distinctDays,
    3,
    range.sampleCount,
    "merchant observation days",
  );
  integer(range.maximumMinor, 1, 3_000_000_000_000, "merchant maximum");
  timestamp(range.firstObservedAt);
  timestamp(range.lastObservedAt);
  if (
    range.firstObservedAt < context.windowStart ||
    range.lastObservedAt >= context.evaluatedAt ||
    Date.parse(range.lastObservedAt) - Date.parse(range.firstObservedAt) <
      7 * 86400000 ||
    Date.parse(context.evaluatedAt) - Date.parse(range.lastObservedAt) >
      context.freshnessDays * 86400000
  )
    fail();
  integer(
    range.evidenceCount,
    range.sampleCount,
    context.evidenceCount,
    "merchant evidence count",
  );
  const ids = list(range.evidenceIds, 50, "merchant evidence");
  ids.forEach(identifier);
  if (
    new Set(ids).size !== ids.length ||
    ids.includes(context.eventId) ||
    ids.length !== Math.min(50, range.evidenceCount) ||
    typeof range.evidenceHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(range.evidenceHash)
  )
    fail();
  return range.maximumMinor;
}
