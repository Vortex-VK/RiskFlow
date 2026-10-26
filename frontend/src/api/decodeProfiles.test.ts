import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/evaluations/simulator-v3/profiles-run.json";
import { decodeAssessment } from "./decodeAssessment";
import { decodeRun } from "./decodeRun";

function changed() {
  return structuredClone(fixture);
}

describe("historical profile contract", () => {
  it("decodes learned baselines, cold start and familiarity without granting trust", () => {
    const run = decodeAssessment(fixture);
    expect(run.simulation?.engineVersion).toBe("engine-v2");
    expect(run.simulation?.events[10]?.riskScore).toBe(45);
    expect(run.simulation?.events[10]?.features.typicalAmountMinor).toBe(1000);
    expect(run.profiles?.events[0]?.signals[0]?.source).toBe("unavailable");
    expect(run.profiles?.events[10]?.signals[0]?.sampleCount).toBe(10);
    expect(run.profiles?.events[10]?.signals[3]?.trustState).toBe("unknown");
    expect(run.profiles?.events[10]?.signals[3]?.evaluation.points).toBe(0);
  });

  it("does not accept a profiled engine response through the V1 decoder", () => {
    const run = decodeAssessment(fixture);
    expect(() => decodeRun(fixture.simulation, run.document)).toThrow();
  });

  for (const [name, mutate] of [
    [
      "missing profiles",
      (r: typeof fixture) => {
        r.profiles.events = [];
      },
    ],
    [
      "duplicate profiles",
      (r: typeof fixture) => {
        r.profiles.events[1] = r.profiles.events[0]!;
      },
    ],
    [
      "baseline mismatch",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.medianMinor = 999;
      },
    ],
    [
      "current event evidence",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.evidenceIds[0] =
          r.profiles.events[10]!.eventId;
      },
    ],
    [
      "future history",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.lastObservedAt =
          "2026-02-01T00:00:00.000Z";
      },
    ],
    [
      "too few samples",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.sampleCount = 9;
      },
    ],
    [
      "fabricated trust",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[3]!.trustState = "trusted";
      },
    ],
    [
      "missing evidence",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.evidenceIds = [];
      },
    ],
    [
      "changed scoring rule",
      (r: typeof fixture) => {
        r.profiles.events[10]!.signals[0]!.evaluation.points = 30;
      },
    ],
    [
      "unknown configuration",
      (r: typeof fixture) => {
        r.profiles.config.version = "future";
      },
    ],
  ] as const) {
    it(`rejects ${name}`, () => {
      const run = changed();
      mutate(run);
      expect(() => decodeAssessment(run)).toThrow();
    });
  }
});
