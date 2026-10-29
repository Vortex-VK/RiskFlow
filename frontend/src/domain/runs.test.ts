import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import hero from "../../../fixtures/scenarios/shared-device-cluster.json";
import { decodeDocument } from "../api/decode";
import {
  freeze,
  normalizedScenario,
  playbackPosition,
  presentationSchedule,
  projectAnalyticalInput,
} from "./runs";
import { useWorkspace } from "../state/workspace";
import { useSimulation } from "../state/simulation";

describe("captured runs and analytical identity", () => {
  it("normalizes optional categories and treats source categories as ranking inputs", () => {
    const scenario = decodeDocument(structuredClone(hero)).scenario;
    const original = normalizedScenario(scenario);
    const originalFacts = projectAnalyticalInput(scenario);
    scenario.payments[0]!.category = null;
    scenario.payments[0]!.sourceCategory = null;
    expect(normalizedScenario(scenario)).toBe(original);
    scenario.payments[0]!.sourceCategory = "supermarket";
    expect(projectAnalyticalInput(scenario)).not.toBe(originalFacts);
    scenario.payments[0]!.category = "groceries";
    expect(projectAnalyticalInput(scenario)).not.toBe(originalFacts);
  });
  it("condenses large playback without dropping events or changing event order", () => {
    const input = Array.from({ length: 10000 }, () => ({
      occurredAt: "2026-10-20T09:00:00.000Z",
    }));
    const schedule = presentationSchedule(input);
    expect(schedule).toHaveLength(10000);
    expect(schedule.at(-1)!.end).toBeCloseTo(30000);
    for (const index of [0, 5000, 9999]) {
      const slot = schedule[index]!;
      expect(
        playbackPosition(schedule, (slot.start + slot.end) / 2),
      ).toMatchObject({ active: index });
      expect(
        playbackPosition(schedule, (slot.start + slot.end) / 2).progress,
      ).toBeCloseTo(0.5);
    }
    expect(playbackPosition(schedule, 30000)).toMatchObject({
      cursor: 9999,
      completed: true,
    });
  });
  it("ignores display, layout and array order while detecting facts, labels, policy and costs", () => {
    const document = decodeDocument(structuredClone(hero));
    const original = projectAnalyticalInput(document.scenario);
    document.view.positions["account-a"]!.x += 100;
    document.scenario.nodes.reverse();
    document.scenario.payments.reverse();
    document.scenario.associations.reverse();
    document.scenario.name = "Another display name";
    document.scenario.nodes[0]!.name = "Renamed";
    expect(projectAnalyticalInput(document.scenario)).toBe(original);
    for (const change of [
      (s: typeof document.scenario) => {
        s.payments[0]!.amountMinor++;
      },
      (s: typeof document.scenario) => {
        s.groundTruth = {};
      },
      (s: typeof document.scenario) => {
        s.policy.blockThreshold++;
      },
      (s: typeof document.scenario) => {
        s.costAssumptions.reviewCostMinor++;
      },
    ]) {
      const next = structuredClone(document.scenario);
      change(next);
      expect(projectAnalyticalInput(next)).not.toBe(original);
    }
    expect(normalizedScenario(document.scenario)).not.toBe(
      normalizedScenario(decodeDocument(hero).scenario),
    );
  });
  it("deep freezes an isolated captured document", () => {
    const draft = decodeDocument(structuredClone(hero));
    const captured = freeze(structuredClone(draft));
    draft.scenario.payments[0]!.amountMinor++;
    expect(captured.scenario.payments[0]!.amountMinor).not.toBe(
      draft.scenario.payments[0]!.amountMinor,
    );
    expect(Object.isFrozen(captured.scenario.payments[0])).toBe(true);
  });
});

describe("presentation clock", () => {
  it("increases the per-payment pace with dataset size while preserving small runs", () => {
    const scheduleFor = (count: number) =>
      presentationSchedule(
        Array.from({ length: count }, () => ({
          occurredAt: "2026-10-20T09:00:00Z",
        })),
      );
    expect(scheduleFor(60)[1]).toEqual({ start: 1050, end: 1450 });
    let previousInterval = Infinity;
    for (const count of [60, 232, 1000, 10000]) {
      const schedule = scheduleFor(count);
      const interval = schedule[1]!.start - schedule[0]!.start;
      expect(interval).toBeLessThan(previousInterval);
      expect(schedule).toHaveLength(count);
      previousInterval = interval;
    }
    expect(scheduleFor(1000).at(-1)!.end / 1.25).toBeCloseTo(24_000);
    expect(scheduleFor(10000).at(-1)!.end / 1.25).toBeCloseTo(24_000);
  });
  it("fits the hero schedule into 12.4 seconds at 2× without using event order as time", () => {
    const schedule = presentationSchedule(
      decodeDocument(hero).scenario.payments,
    );
    expect(schedule[0]).toEqual({ start: 400, end: 800 });
    expect(schedule.at(-1)!.end / 2).toBe(12400);
    expect(playbackPosition(schedule, 0)).toEqual({
      cursor: -1,
      active: -1,
      progress: 0,
      completed: false,
    });
    expect(playbackPosition(schedule, 600)).toMatchObject({
      cursor: -1,
      active: 0,
      progress: 0.5,
    });
    expect(playbackPosition(schedule, 800)).toMatchObject({
      cursor: 0,
      active: -1,
    });
    expect(playbackPosition(schedule, schedule.at(-1)!.end)).toMatchObject({
      cursor: 15,
      active: -1,
      completed: true,
    });
  });
  it("clamps simultaneous and widely separated events and supports an empty idle schedule", () => {
    const schedule = presentationSchedule([
      { occurredAt: "2026-01-15T10:00:00.000Z" },
      { occurredAt: "2026-01-15T10:00:00.000Z" },
      { occurredAt: "2026-01-16T10:00:00.000Z" },
    ]);
    expect(schedule).toEqual([
      { start: 400, end: 800 },
      { start: 1050, end: 1450 },
      { start: 2650, end: 3050 },
    ]);
    expect(playbackPosition([], 0)).toMatchObject({
      cursor: -1,
      active: -1,
      completed: false,
    });
  });
});

describe("pending request guards", () => {
  beforeEach(() => {
    useWorkspace.getState().replace(decodeDocument(structuredClone(hero)));
  });
  afterEach(() => {
    useWorkspace.getState().replace(decodeDocument(structuredClone(hero)));
    vi.unstubAllGlobals();
  });
  it.each(["buffer", "replacement", "analytical edit", "layout undo"])(
    "aborts a request on %s and does not open results",
    async (kind) => {
      if (kind === "layout undo") {
        const doc = structuredClone(useWorkspace.getState().document!);
        doc.view.positions["account-a"]!.x += 10;
        useWorkspace.getState().commit(doc, "Moved");
      }
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url, options: RequestInit) =>
            new Promise((_resolve, reject) => {
              signal = options.signal!;
              signal.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError")),
              );
            }),
        ),
      );
      const pending = useSimulation.getState().run();
      expect(useSimulation.getState().pending).toBe(true);
      if (kind === "buffer") useWorkspace.setState({ dirty: true });
      else if (kind === "replacement")
        useWorkspace.getState().replace(decodeDocument(structuredClone(hero)));
      else if (kind === "layout undo") useWorkspace.getState().undo();
      else {
        const doc = structuredClone(useWorkspace.getState().document!);
        doc.scenario.payments[0]!.amountMinor++;
        useWorkspace.getState().commit(doc, "Changed");
      }
      await pending;
      expect(signal!.aborted).toBe(true);
      expect(useSimulation.getState()).toMatchObject({
        pending: false,
        viewing: false,
        latest: null,
        error: "",
      });
    },
  );
});
