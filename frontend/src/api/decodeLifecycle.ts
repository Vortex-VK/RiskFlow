import { identifier, integer, list, object, text } from "./decode";
import type { components } from "./generated";

type LifecycleReport = components["schemas"]["LifecycleReport"];

export function decodeLifecycle(
  value: unknown,
  eventIds: Set<string>,
): LifecycleReport {
  const report = object(
    value,
    ["version", "entries", "currencies"],
    "lifecycle report",
  );
  const require = (condition: boolean) => {
    if (!condition)
      throw new Error("Invalid lifecycle accounting. Reload the assessment.");
  };
  require(report.version === "lifecycle-v1");
  const entries = list(report.entries, 20000, "lifecycle entries");
  const seen = new Set<string>();
  const totals = new Map<string, number[]>();
  for (const raw of entries) {
    const entry = object(
      raw,
      [
        "eventId",
        "sourceEventId",
        "accountId",
        "transactionId",
        "currency",
        "kind",
        "attempt",
        "settledMinor",
        "refundedMinor",
        "reversedMinor",
        "relatedEventId",
        "resolution",
        "reason",
      ],
      "lifecycle entry",
    );
    identifier(entry.eventId);
    require(eventIds.has(entry.eventId) && !seen.has(entry.eventId));
    seen.add(entry.eventId);
    text(entry.sourceEventId, "source event", 200);
    text(entry.accountId, "account", 200);
    if (entry.transactionId !== null)
      text(entry.transactionId, "transaction", 200);
    require(
      typeof entry.currency === "string" && /^[A-Z]{3}$/.test(entry.currency),
    );
    require(
      [
        "purchase",
        "authorization",
        "capture",
        "refund",
        "reversal",
        "status_update",
        "unsupported",
      ].includes(String(entry.kind)),
    );
    require(typeof entry.attempt === "boolean");
    require(
      ["resolved", "standalone", "unresolved", "excluded"].includes(
        String(entry.resolution),
      ),
    );
    text(entry.reason, "lifecycle reason", 2000);
    if (entry.relatedEventId !== null) {
      identifier(entry.relatedEventId);
      require(
        eventIds.has(entry.relatedEventId) &&
          entry.relatedEventId !== entry.eventId,
      );
    }
    for (const key of ["settledMinor", "refundedMinor", "reversedMinor"])
      integer(entry[key], 0, 100000000, key);
    require(
      !entry.attempt ||
        ["purchase", "authorization"].includes(String(entry.kind)),
    );
    require(
      entry.settledMinor === 0 ||
        ["purchase", "capture"].includes(String(entry.kind)),
    );
    require(
      entry.refundedMinor === 0 ||
        (entry.kind === "refund" && entry.resolution === "resolved"),
    );
    require(
      entry.reversedMinor === 0 ||
        (entry.kind === "reversal" && entry.resolution === "resolved"),
    );
    const values = [
      Number(entry.attempt),
      Number(entry.settledMinor),
      Number(entry.refundedMinor),
      Number(entry.reversedMinor),
      Number(entry.resolution === "unresolved"),
      Number(entry.resolution === "excluded"),
    ];
    const total = totals.get(String(entry.currency)) ?? [0, 0, 0, 0, 0, 0];
    totals.set(
      String(entry.currency),
      total.map((n, i) => n + values[i]!),
    );
  }
  require(seen.size === eventIds.size);
  const typedEntries = entries as LifecycleReport["entries"];
  const byId = new Map(typedEntries.map((entry) => [entry.eventId, entry]));
  const adjustments = new Map<string, number>();
  for (const entry of typedEntries) {
    const amount = entry.refundedMinor + entry.reversedMinor;
    if (!amount) continue;
    const target = entry.relatedEventId
      ? byId.get(entry.relatedEventId)
      : undefined;
    require(
      target !== undefined &&
        target.currency === entry.currency &&
        target.accountId === entry.accountId,
    );
    const total = (adjustments.get(target!.eventId) ?? 0) + amount;
    require(total <= target!.settledMinor);
    adjustments.set(target!.eventId, total);
  }
  const currencies = list(report.currencies, 20000, "currency populations");
  require(currencies.length === totals.size);
  for (const raw of currencies) {
    const population = object(
      raw,
      [
        "currency",
        "attemptCount",
        "settledMinor",
        "refundedMinor",
        "reversedMinor",
        "netOutflowMinor",
        "unresolvedCount",
        "excludedCount",
      ],
      "currency population",
    );
    const total = totals.get(String(population.currency));
    require(total !== undefined);
    [
      "attemptCount",
      "settledMinor",
      "refundedMinor",
      "reversedMinor",
      "unresolvedCount",
      "excludedCount",
    ].forEach((key, i) => require(population[key] === total![i]));
    integer(population.netOutflowMinor, 0, 2000000000000, "net outflow");
    require(
      population.netOutflowMinor === total![1]! - total![2]! - total![3]!,
    );
    totals.delete(String(population.currency));
  }
  return report as LifecycleReport;
}
