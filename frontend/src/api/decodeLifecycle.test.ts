import { describe, expect, it } from "vitest";
import reference from "../../../fixtures/evaluations/simulator-v2/lifecycle-run.json";
import { decodeAssessment, decodePreview } from "./decodeAssessment";

describe("lifecycle and temporal assessment contract", () => {
  it("decodes separate attempts and spending with an explicit source cutoff", () => {
    const run = decodeAssessment(reference);
    expect(run.mode).toBe("as_known");
    expect(run.knowledgeCutoff).toBe("2026-10-01T10:08:00.000Z");
    expect(run.simulation?.events).toHaveLength(2);
    expect(run.assessments.filter((item) => item.score === null)).toHaveLength(
      6,
    );
    expect(run.lifecycle?.currencies).toEqual([
      {
        currency: "USD",
        attemptCount: 2,
        settledMinor: 10000,
        refundedMinor: 2000,
        reversedMinor: 4000,
        netOutflowMinor: 4000,
        unresolvedCount: 0,
        excludedCount: 0,
      },
    ]);
  });

  it.each([
    [
      "refund linked to an authorization",
      (run: typeof reference) => {
        run.lifecycle.entries.find(
          (item) => item.kind === "refund",
        )!.relatedEventId = run.lifecycle.entries[0]!.eventId;
      },
    ],
    [
      "cross-account refund",
      (run: typeof reference) => {
        run.lifecycle.entries.find(
          (item) => item.kind === "refund",
        )!.accountId = "another-account";
      },
    ],
    [
      "mismatched source identity",
      (run: typeof reference) => {
        run.lifecycle.entries[0]!.sourceEventId = "another-source-event";
      },
    ],
    [
      "invented total",
      (run: typeof reference) => {
        run.lifecycle.currencies[0]!.netOutflowMinor = 6000;
      },
    ],
    [
      "duplicate currency",
      (run: typeof reference) => {
        run.lifecycle.currencies.push(run.lifecycle.currencies[0]!);
      },
    ],
    [
      "missing lifecycle record",
      (run: typeof reference) => {
        run.lifecycle.entries.pop();
      },
    ],
    [
      "duplicate lifecycle record",
      (run: typeof reference) => {
        run.lifecycle.entries.push(run.lifecycle.entries[0]!);
      },
    ],
    [
      "unlinked invented target",
      (run: typeof reference) => {
        run.lifecycle.entries[0]!.relatedEventId = "absent";
      },
    ],
    [
      "unknown lifecycle kind",
      (run: typeof reference) => {
        run.lifecycle.entries[0]!.kind = "fraud";
      },
    ],
    [
      "missing cutoff",
      (run: typeof reference) => {
        run.knowledgeCutoff = "";
      },
    ],
    [
      "unsupported temporal mode",
      (run: typeof reference) => {
        run.mode = "authorization";
      },
    ],
    [
      "mismatched adapter",
      (run: typeof reference) => {
        run.adapterVersion = "retained-v1";
      },
    ],
    [
      "unrecognized lifecycle version",
      (run: typeof reference) => {
        run.lifecycle.version = "lifecycle-v99";
      },
    ],
    [
      "attempt missing from population",
      (run: typeof reference) => {
        run.lifecycle.entries[0]!.attempt = false;
        run.lifecycle.currencies[0]!.attemptCount = 1;
      },
    ],
  ])("rejects %s", (_, change) => {
    const altered = structuredClone(reference);
    change(altered);
    expect(() => decodeAssessment(altered)).toThrow();
  });

  it("requires reviewable differences and a reason for corrected rows", () => {
    const preview = {
      id: "preview",
      datasetId: "dataset",
      expectedRevision: 1,
      sourceHash: "a".repeat(64),
      filename: "correction.csv",
      mapping: {},
      errors: [],
      rows: [
        {
          row: 2,
          sourceEventId: "source",
          eventId: "event",
          disposition: "corrected",
          analyticalStatus: "eligible",
          reason: "Corrected amount",
          changes: [{ field: "amount_minor", before: "10000", after: "8000" }],
        },
      ],
      canCommit: true,
      committedRevision: null,
    };
    expect(decodePreview(preview).rows[0]!.disposition).toBe("corrected");
    const missing = structuredClone(preview);
    missing.rows[0]!.changes = [];
    expect(() => decodePreview(missing)).toThrow();
    const unchanged = structuredClone(preview);
    unchanged.rows[0]!.changes[0]!.after = "10000";
    expect(() => decodePreview(unchanged)).toThrow();
  });
});
