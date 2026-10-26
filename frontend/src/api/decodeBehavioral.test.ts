import { describe, expect, it } from "vitest";
import { decodeBehavioral } from "./decodeBehavioral";

const evidence = {
  version: "behavioral-features-v1",
  analysisKind: "descriptive",
  historyCount: 2,
  horizonDays: 30,
  medianAmount: "10",
  amountRatio: 10,
  prior24HCount: 1,
  currency: "USD",
  timePrecision: "date",
  evidenceIds: ["a", "b"],
  evidenceTruncated: false,
  merchantIdentityAvailable: false,
  occurredAt: "2026-01-03T00:00:00.000Z",
  observedAmount: "100",
};

describe("behavioral evidence", () => {
  it("accepts supported descriptive observations", () => {
    expect(decodeBehavioral(evidence).amountRatio).toBe(10);
  });
  it.each([
    { analysisKind: "probability" },
    { evidenceIds: ["a", "a"] },
    { evidenceIds: ["a"] },
    { evidenceTruncated: true },
    { amountRatio: Infinity },
    { medianAmount: "NaN" },
    { historyCount: 0 },
    { prior24HCount: 3 },
    { currency: "EUR" },
    { score: 0.7 },
    { observedAmount: "-10" },
  ])("rejects inconsistent or invented evidence %j", (change) => {
    expect(() => decodeBehavioral({ ...evidence, ...change })).toThrow();
  });
});
