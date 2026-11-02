import { identifier, integer, list, object, text, timestamp } from "./decode";
import type { components } from "./generated";
import type { Document } from "../domain/types";
import { decodeMerchantRange } from "./decodeMerchantRange";

export type ProfileReport = components["schemas"]["ProfileReport"];

export function decodeProfiles(
  value: unknown,
  document: Document,
): ProfileReport {
  const fail = () => {
    throw new Error("Invalid historical profile evidence. Reload the dataset.");
  };
  const report = object(value, ["config", "events"], "profiles");
  const config = object(
    report.config,
    [
      "version",
      "purchaseWindowDays",
      "purchaseMinSamples",
      "purchaseMinSpanDays",
      "purchaseFreshnessDays",
      "billWindowDays",
      "billMinSamples",
      "billMinSpanDays",
      "billFreshnessDays",
      "deviceMinUses",
      "deviceMinSpanDays",
    ],
    "profile configuration",
  );
  if (!["profiles-v1", "profiles-v2"].includes(String(config.version))) fail();
  for (const key of [
    "purchaseWindowDays",
    "purchaseMinSamples",
    "purchaseMinSpanDays",
    "purchaseFreshnessDays",
    "billWindowDays",
    "billMinSamples",
    "billMinSpanDays",
    "billFreshnessDays",
    "deviceMinUses",
    "deviceMinSpanDays",
  ])
    integer(config[key], 1, 365, key);
  const payments = new Map(document.scenario.payments.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const raw of list(report.events, 10000, "profiles")) {
    const profile = object(
      raw,
      ["eventId", "accountId", "currency", "signals"],
      "profile",
    );
    identifier(profile.eventId);
    text(profile.accountId, "profile account", 200);
    if (profile.currency !== "USD" || seen.has(profile.eventId)) fail();
    seen.add(profile.eventId);
    const payment = payments.get(profile.eventId);
    if (!payment) throw new Error("Profile has no assessed payment.");
    const rules = new Set<string>();
    for (const rawSignal of list(profile.signals, 4, "profile signals")) {
      const signal = object(
        rawSignal,
        [
          "evaluation",
          "source",
          "population",
          "sampleCount",
          "minimumSamples",
          "minimumSpanDays",
          "windowStart",
          "evaluatedAt",
          "firstObservedAt",
          "lastObservedAt",
          "evidenceIds",
          "evidenceCount",
          "evidenceHash",
          "medianMinor",
          "medianAbsoluteDeviationMinor",
          "baselineValues",
          "trustState",
          "trustEffectiveAt",
          "trustProvenance",
          "trustEventId",
          "merchantRange",
        ],
        "profile signal",
      );
      const evaluation = object(
        signal.evaluation,
        [
          "ruleId",
          "available",
          "triggered",
          "points",
          "measured",
          "thresholds",
          "evidence",
          "explanation",
        ],
        "profile evaluation",
      );
      text(evaluation.ruleId, "profile rule");
      if (
        ![
          "unusual_amount",
          "merchant_category_deviation",
          "unusual_location",
          "new_device",
        ].includes(evaluation.ruleId) ||
        rules.has(evaluation.ruleId)
      )
        fail();
      rules.add(evaluation.ruleId);
      if (
        !["historical", "configured", "observation", "unavailable"].includes(
          String(signal.source),
        ) ||
        evaluation.available !== (signal.source !== "unavailable")
      )
        fail();
      if (
        payment.unavailableRules?.includes(
          evaluation.ruleId as "unusual_amount",
        ) === evaluation.available
      )
        fail();
      text(signal.population, "profile population", 250);
      integer(signal.sampleCount, 0, 20000, "profile samples");
      integer(signal.minimumSamples, 1, 100, "minimum samples");
      integer(signal.minimumSpanDays, 0, 90, "minimum span");
      timestamp(signal.windowStart);
      timestamp(signal.evaluatedAt);
      if (
        signal.evaluatedAt !== payment.occurredAt ||
        signal.windowStart > signal.evaluatedAt
      )
        fail();
      for (const key of ["firstObservedAt", "lastObservedAt"] as const) {
        if (signal[key] !== null) {
          timestamp(signal[key]);
          if (
            signal[key] >= signal.evaluatedAt ||
            signal[key] < signal.windowStart
          )
            fail();
        }
      }
      if (
        (signal.sampleCount === 0) !==
        (signal.firstObservedAt === null && signal.lastObservedAt === null)
      )
        fail();
      if (
        signal.firstObservedAt &&
        signal.lastObservedAt &&
        String(signal.firstObservedAt) > String(signal.lastObservedAt)
      )
        fail();
      const ids = list(signal.evidenceIds, 50, "profile evidence");
      ids.forEach(identifier);
      integer(
        signal.evidenceCount,
        signal.sampleCount,
        20000,
        "profile evidence count",
      );
      if (ids.length !== Math.min(50, signal.evidenceCount)) fail();
      if (
        new Set(ids).size !== ids.length ||
        ids.includes(profile.eventId) ||
        (signal.sampleCount > 0 && !ids.length)
      )
        fail();
      if (
        typeof signal.evidenceHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(signal.evidenceHash)
      )
        fail();
      for (const key of [
        "medianMinor",
        "medianAbsoluteDeviationMinor",
      ] as const)
        if (signal[key] !== null)
          integer(
            signal[key],
            key === "medianMinor" ? 1 : 0,
            3_000_000_000_000,
            key,
          );
      list(signal.baselineValues, 20000, "baseline values").forEach((v) =>
        text(v, "baseline value", 200),
      );
      if (
        !["unknown", "trusted", "revoked"].includes(String(signal.trustState))
      )
        fail();
      if (signal.trustState === "unknown") {
        if (
          signal.trustEffectiveAt !== null ||
          signal.trustProvenance !== null ||
          signal.trustEventId !== null
        )
          fail();
      } else {
        timestamp(signal.trustEffectiveAt);
        text(signal.trustProvenance, "trust provenance", 200);
        identifier(signal.trustEventId);
        if (
          signal.trustEffectiveAt > signal.evaluatedAt ||
          evaluation.ruleId !== "new_device"
        )
          fail();
      }
      if (signal.source === "historical") {
        if (
          signal.sampleCount < signal.minimumSamples ||
          !signal.firstObservedAt ||
          !signal.lastObservedAt
        )
          fail();
        if (
          Date.parse(String(signal.lastObservedAt)) -
            Date.parse(String(signal.firstObservedAt)) <
          signal.minimumSpanDays * 86400000
        )
          fail();
        const bill = String(signal.population).startsWith("bill:");
        const freshness = Number(
          config[bill ? "billFreshnessDays" : "purchaseFreshnessDays"],
        );
        if (
          Date.parse(signal.evaluatedAt) -
            Date.parse(String(signal.lastObservedAt)) >
          freshness * 86400000
        )
          fail();
      }
      if (signal.source === "observation" && evaluation.ruleId !== "new_device")
        fail();
      const thresholds = evaluation.thresholds as Record<string, unknown>;
      if (evaluation.ruleId === "unusual_amount") {
        if (
          thresholds.mediumMultiple !== 3 ||
          thresholds.highMultiple !== 6 ||
          Object.keys(thresholds).length !== 2
        )
          fail();
      } else if (Object.keys(thresholds).length) fail();
      const measured = evaluation.measured as Record<string, unknown>;
      let merchantMaximum: number | null = null;
      if (signal.merchantRange != null) {
        if (
          config.version !== "profiles-v2" ||
          evaluation.ruleId !== "unusual_amount" ||
          signal.source !== "historical" ||
          signal.population !== "purchase"
        )
          fail();
        merchantMaximum = decodeMerchantRange(signal.merchantRange, {
          eventId: profile.eventId,
          windowStart: signal.windowStart,
          evaluatedAt: signal.evaluatedAt,
          freshnessDays: Number(config.purchaseFreshnessDays),
          sampleCount: signal.sampleCount,
          evidenceCount: signal.evidenceCount,
        });
        if (
          measured.merchantMaximumMinor !== merchantMaximum ||
          measured.withinMerchantRange !==
            payment.amountMinor <= merchantMaximum
        )
          fail();
      } else if (
        measured.merchantMaximumMinor !== undefined ||
        measured.withinMerchantRange !== undefined
      )
        fail();
      let points = 0;
      if (evaluation.available) {
        if (evaluation.ruleId === "unusual_amount") {
          integer(signal.medianMinor, 1, 3_000_000_000_000, "amount baseline");
          if (
            measured.typicalAmountMinor !== signal.medianMinor ||
            measured.amountMinor !== payment.amountMinor
          )
            fail();
          points =
            merchantMaximum !== null && payment.amountMinor <= merchantMaximum
              ? 0
              : payment.amountMinor >= Number(signal.medianMinor) * 6
                ? 45
                : payment.amountMinor >= Number(signal.medianMinor) * 3
                  ? 30
                  : 0;
        } else if (evaluation.ruleId === "new_device") {
          if (typeof measured.unfamiliar !== "boolean") fail();
          points = measured.unfamiliar ? 20 : 0;
          if (
            (signal.trustState === "trusted" && points !== 0) ||
            (signal.trustState === "revoked" && points !== 20)
          )
            fail();
        } else {
          text(measured.value, "context value", 200);
          if (
            JSON.stringify(measured.baselineValues) !==
            JSON.stringify(signal.baselineValues)
          )
            fail();
          if (
            typeof measured.specificallyFamiliar !== "boolean" ||
            (evaluation.ruleId === "merchant_category_deviation" &&
              measured.specificallyFamiliar)
          )
            fail();
          points =
            (signal.baselineValues as string[]).includes(
              measured.value as string,
            ) || measured.specificallyFamiliar
              ? 0
              : evaluation.ruleId === "unusual_location"
                ? 20
                : 10;
        }
      }
      if (evaluation.points !== points || evaluation.triggered !== points > 0)
        fail();
    }
    if (rules.size !== 4) fail();
  }
  if (seen.size !== payments.size) fail();
  return report as ProfileReport;
}
