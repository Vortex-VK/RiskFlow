import { describe, expect, it } from "vitest";
import reference from "../../../fixtures/evaluations/simulator-v2/burst-run.json";
import {
  decodeAssessment,
  decodePreview,
  decodeEventPage,
} from "./decodeAssessment";

describe("retained assessment contract", () => {
  it("accepts a frozen V2 envelope with the separately validated V1 calculation", () => {
    const run = decodeAssessment(reference);
    expect(run.schemaVersion).toBe(2);
    expect(run.simulation?.schemaVersion).toBe(1);
    expect(run.assessments.map((item) => item.score)).toEqual([
      20, 20, 45, 45, 70, 70, 80, 80,
    ]);
    expect(run.assessments.every((item) => item.coverage === "partial")).toBe(
      true,
    );
  });

  it.each([
    [
      "future schema",
      (run: typeof reference) => {
        run.schemaVersion = 3;
      },
    ],
    [
      "future adapter",
      (run: typeof reference) => {
        run.adapterVersion = "retained-v9";
      },
    ],
    [
      "probability-like score",
      (run: typeof reference) => {
        run.assessments[0]!.score = 0.2;
      },
    ],
    [
      "invented coverage",
      (run: typeof reference) => {
        run.assessments[0]!.coverage = "complete";
      },
    ],
    [
      "invented recommendation",
      (run: typeof reference) => {
        run.assessments[0]!.recommendation = "high_priority";
      },
    ],
    [
      "invented availability",
      (run: typeof reference) => {
        run.assessments[0]!.signals[0]!.available = true;
      },
    ],
    [
      "missing result",
      (run: typeof reference) => {
        run.assessments.pop();
      },
    ],
    [
      "duplicate result",
      (run: typeof reference) => {
        run.assessments.push(run.assessments[0]!);
      },
    ],
    [
      "different dataset",
      (run: typeof reference) => {
        run.datasetId = "another-dataset";
      },
    ],
    [
      "corrupt V1 arithmetic",
      (run: typeof reference) => {
        run.simulation.events[0]!.riskScore = 99;
      },
    ],
    [
      "different run identity",
      (run: typeof reference) => {
        run.id = "another-run";
      },
    ],
  ])("rejects %s without weakening legacy validation", (_, change) => {
    const altered = structuredClone(reference);
    change(altered);
    expect(() => decodeAssessment(altered)).toThrow();
  });

  it("rejects a conflict preview claiming that commit is safe", () => {
    const preview = {
      id: "preview",
      datasetId: "dataset",
      expectedRevision: 1,
      sourceHash: "a".repeat(64),
      filename: "test.csv",
      mapping: {},
      errors: [],
      rows: [
        {
          row: 2,
          sourceEventId: "source",
          eventId: "event",
          disposition: "conflict",
          analyticalStatus: "eligible",
          reason: "Changed amount",
        },
      ],
      canCommit: false,
      committedRevision: null,
    };
    expect(decodePreview(preview).canCommit).toBe(false);
    expect(() => decodePreview({ ...preview, canCommit: true })).toThrow();
  });
});

describe("retained activity contract", () => {
  const event = {
    id: "event",
    sourceEventId: "T1",
    sourceNamespace: "bank",
    accountId: "A1",
    occurredAt: "2026-10-21T00:00:00.000Z",
    timePrecision: "instant",
    sourceAvailableAt: null,
    underlyingTransactionId: null,
    amountMinor: 1000,
    currency: "USD",
    direction: "debit",
    activityType: "refund",
    status: "completed",
    merchantId: null,
    merchantName: "Shop",
    merchantCountry: "US",
    category: "retail",
    sourceCategory: "retail",
    deviceId: null,
    locationId: null,
    locationCountry: null,
    deviceKnownFrom: null,
    locationKnownFrom: null,
    typicalAmountMinor: null,
    usualCountries: [],
    usualCategories: [],
    context: {},
    sourceFields: { transaction_id: "T1" },
  };
  const item = {
    event,
    acceptedRevision: 1,
    recordedAt: "2026-10-21T00:00:00.000Z",
    importId: "import",
    sourceRow: 2,
    analyticalStatus: "not_assessed",
    reason: "Refunds not yet assessed.",
  };
  const page = { items: [item], total: 1, offset: 0, limit: 50 };

  it("preserves source activity and unavailable context", () => {
    const decoded = decodeEventPage(page);
    expect(decoded.items[0]!.event.activityType).toBe("refund");
    expect(decoded.items[0]!.event.deviceId).toBeNull();
    expect(decoded.items[0]!.event.sourceFields.transaction_id).toBe("T1");
  });

  it.each([
    [
      "invalid country",
      {
        ...page,
        items: [{ ...item, event: { ...event, merchantCountry: "ZZ" } }],
      },
    ],
    [
      "invalid taxonomy",
      {
        ...page,
        items: [{ ...item, event: { ...event, category: "made-up" } }],
      },
    ],
    [
      "missing context",
      {
        ...page,
        items: [{ ...item, event: { ...event, context: undefined } }],
      },
    ],
    ["unexplained exclusion", { ...page, items: [{ ...item, reason: null }] }],
    ["incomplete page", { ...page, total: 2 }],
    ["duplicated source record", { ...page, items: [item, item], total: 2 }],
  ])("rejects %s", (_, value) => {
    expect(() => decodeEventPage(value)).toThrow();
  });
});
