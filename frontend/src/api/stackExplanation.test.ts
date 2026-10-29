import { afterEach, expect, it, vi } from "vitest";
import {
  decodeStackExplanation,
  fetchStackExplanation,
} from "./stackExplanation";
import type { Scenario } from "../domain/types";
import {
  priorityComparison,
  priorityPoints,
  checkPointBreakdown,
} from "../domain/rankingExplanation";
import explanation from "../../../fixtures/runtime/stack-d5/explanation.json";
import run from "../../../fixtures/runtime/stack-d5/run.json";
import type { EventResult } from "../domain/runs";

const event = run.events.find(
  (e) => e.eventId === explanation.eventId,
)! as EventResult;

afterEach(() => vi.unstubAllGlobals());

it("distinguishes an outdated backend from a changed snapshot", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: { message: "This saved result uses a different model version." },
      }),
      { status: 409 },
    ),
  );
  await expect(
    fetchStackExplanation(
      run.scenarioSnapshot as Scenario,
      event,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Restart RiskFlow");
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: { message: "This snapshot does not reproduce the saved score." },
      }),
      { status: 409 },
    ),
  );
  await expect(
    fetchStackExplanation(
      run.scenarioSnapshot as Scenario,
      event,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Run Simulate again");
});

it("checks all head contributions against the recorded prediction", () => {
  expect(
    decodeStackExplanation(explanation, event).facts.length,
  ).toBeGreaterThan(2);
  for (const changed of [
    { ...explanation, rawMargin: explanation.rawMargin + 1 },
    { ...explanation, baseValue: explanation.baseValue + 1 },
    { ...explanation, contributions: explanation.contributions.slice(1) },
    { ...explanation, probability: 90 },
  ])
    expect(() => decodeStackExplanation(changed, event)).toThrow();
});

it("reconstructs a pairwise point difference, including opposing inputs and rounded totals", () => {
  const data = decodeStackExplanation(explanation, event);
  const contributions = data.contributions.map((row, i) => ({
    ...row,
    contribution:
      row.contribution -
      (i === 0 ? 0.91345 : i === 1 ? -0.81234 : i % 2 ? -0.12345 : 0.23456),
  }));
  const reference = {
    ...data,
    eventId: "reference",
    contributions,
    rawMargin:
      data.baseValue +
      contributions.reduce((sum, r) => sum + r.contribution, 0),
  };
  const result = priorityComparison(data, reference);
  expect(result.final).toBe(
    Math.round((data.rawMargin - reference.rawMargin) * 100),
  );
  expect(result.start).toBe(0);
  expect(result.steps.reduce((n, s) => n + s.difference, 0)).toBe(
    result.difference,
  );
  expect(result.difference).toBe(result.final - result.start);
  expect(result.steps.some((s) => s.difference > 0)).toBe(true);
  expect(result.steps.some((s) => s.difference < 0)).toBe(true);
  expect(result.steps.at(-1)!.to).toBe(result.final);
  expect(
    result.remainingSteps.reduce((sum, row) => sum + row.difference, 0),
  ).toBe(result.steps.at(-1)!.difference);
  const visible = new Set(result.steps.slice(0, 4).map((row) => row.feature));
  expect(result.remainingSteps.every((row) => !visible.has(row.feature))).toBe(
    true,
  );
  expect(result.remainingSteps.length + 4).toBe(data.contributions.length);
  const reversed = priorityComparison(reference, data);
  expect(reversed.difference).toBe(-result.difference);
  expect(reversed.steps.reduce((sum, s) => sum + s.difference, 0)).toBe(
    reversed.difference,
  );
});

it("handles the middle payment itself and keeps points unbounded on a fixed scale", () => {
  const data = decodeStackExplanation(explanation, event);
  const same = priorityComparison(data, data);
  expect(same.difference).toBe(0);
  expect(same.final).toBe(0);
  expect(same.steps.every((s) => s.difference === 0)).toBe(true);
  expect(priorityPoints(data.baseValue - 2, data.baseValue)).toBeCloseTo(-20);
  expect(priorityPoints(data.baseValue + 15, data.baseValue)).toBeCloseTo(150);
  expect(() =>
    priorityComparison(data, { ...data, baseValue: data.baseValue + 1 }),
  ).toThrow(/baseline/);
  expect(() =>
    priorityComparison(data, {
      ...data,
      contributions: data.contributions.slice(1),
    }),
  ).toThrow(/inputs/);
});

it("reconciles grouped priority points to the parent even across rounding boundaries", () => {
  for (const direction of [-1, 0, 1]) {
    const parts = [1.2246, 1.1117, -0.5932, 2.2069].map((n) => n * direction);
    const check = {
      feature: "expert_rich",
      contribution: parts.reduce((s, n) => s + n, 0),
      observations: parts.map((contribution, i) => ({
        feature: i === 3 ? "other_context" : `feature_${i}`,
        value: null,
        referenceValue: null,
        contribution,
      })),
    };
    const result = checkPointBreakdown(check, {
      from: 17,
      to: 17 + 395 * direction,
    });
    expect(result.total).toBe(395 * direction);
    expect(result.rows.reduce((sum, row) => sum + row.points, 0)).toBe(
      result.total,
    );
    expect(result.rows.at(-1)!.feature).toBe("other_context");
    expect(result.rows[0]!.points).toBe(Math.round(parts[0]! * 100));
    for (let i = 0; i < parts.length; i++)
      expect(Math.abs(result.rows[i]!.points - parts[i]! * 100)).toBeLessThan(
        1.1,
      );
  }
});
