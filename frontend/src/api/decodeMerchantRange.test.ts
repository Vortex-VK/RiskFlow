import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/evaluations/simulator-v4/merchant-range-run.json";
import { decodeAssessment } from "./decodeAssessment";

function signal(run: typeof fixture) {
  return run.profiles.events.find(
    (p) =>
      p.eventId ===
      run.assessments.find((a) => a.sourceEventId === "familiar")!.eventId,
  )!.signals[0]!;
}

describe("observed merchant range evidence", () => {
  it("accepts the new version and preserves unexplained amount deviations", () => {
    const run = decodeAssessment(fixture);
    expect(run.simulation?.engineVersion).toBe("engine-v3");
    expect(run.assessments.slice(-3).map((a) => a.score)).toEqual([0, 45, 45]);
    expect(signal(fixture).merchantRange?.maximumMinor).toBe(10000);
  });

  it.each([
    [
      "different merchant evidence",
      (r: typeof fixture) => {
        signal(r).merchantRange!.evidenceIds[0] = r.assessments.find(
          (a) => a.sourceEventId === "small-0",
        )!.eventId;
      },
    ],
    [
      "unsupported version",
      (r: typeof fixture) => {
        r.profiles.config.version = "profiles-v1";
      },
    ],
    [
      "short history",
      (r: typeof fixture) => {
        signal(r).merchantRange!.sampleCount = 2;
      },
    ],
    [
      "same-day repetition",
      (r: typeof fixture) => {
        signal(r).merchantRange!.distinctDays = 1;
      },
    ],
    [
      "changed maximum",
      (r: typeof fixture) => {
        signal(r).merchantRange!.maximumMinor = 9999;
      },
    ],
    [
      "current evidence",
      (r: typeof fixture) => {
        signal(r).merchantRange!.evidenceIds[0] = r.assessments.find(
          (a) => a.sourceEventId === "familiar",
        )!.eventId;
      },
    ],
    [
      "unmatched evidence",
      (r: typeof fixture) => {
        signal(r).merchantRange!.evidenceIds[0] = "unknown";
      },
    ],
    [
      "future observation",
      (r: typeof fixture) => {
        signal(r).merchantRange!.lastObservedAt = "2026-02-01T00:00:00.000Z";
      },
    ],
    [
      "forged suppression",
      (r: typeof fixture) => {
        signal(r).evaluation.points = 45;
      },
    ],
    [
      "missing supporting range",
      (r: typeof fixture) => {
        signal(r).merchantRange = null;
      },
    ],
  ] as const)("rejects %s", (_, mutate) => {
    const changed = structuredClone(fixture);
    mutate(changed);
    expect(() => decodeAssessment(changed)).toThrow();
  });
});
