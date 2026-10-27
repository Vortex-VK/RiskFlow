import { expect, it } from "vitest";
import {
  contributionBreakdown,
  signedContribution,
  scoreProbability,
  probabilityWalkthrough,
} from "./contributionBreakdown";
import type { PaymentExplanation } from "../api/paymentExplanation";

const explanation = (values: number[], baseValue = -8): PaymentExplanation => ({
  eventId: "p",
  modelBundleSha256: "test",
  method: "tree-shap-final-head-v1",
  baseValue,
  rawMargin: baseValue + values.reduce((a, b) => a + b, 0),
  probability: 1,
  contributions: values.map((contribution, i) => ({
    feature: `f${i}`,
    value: null,
    contribution,
  })),
});

it("matches the installed nonlinear calibration, including the screenshot example", () => {
  expect(scoreProbability(0.466)).toBeCloseTo(93.3, 2);
  expect(scoreProbability(0)).toBeCloseTo(87.38, 1);
  expect(scoreProbability(-1000)).toBeGreaterThan(0);
  expect(scoreProbability(1000)).toBeLessThan(100);
});

it("reconstructs both precise and displayed probabilities, retaining opposing steps", () => {
  const data = explanation(
    [6.765, 1.097, 0.592, 0.526, -0.163, 0.3, 0.583],
    -9.233,
  );
  data.probability = scoreProbability(data.rawMargin);
  const result = probabilityWalkthrough(data);
  expect(
    result.start + result.steps.reduce((sum, s) => sum + s.change, 0),
  ).toBeCloseTo(data.probability, 10);
  expect(
    Math.round(result.start * 100) +
      result.steps.reduce(
        (sum, s) => sum + Math.round(s.displayChange * 100),
        0,
      ),
  ).toBe(Math.round(data.probability * 100));
  expect(result.steps.some((s) => s.change < 0)).toBe(true);
  expect(result.steps.at(-1)!.to).toBeCloseTo(data.probability, 10);
  for (const step of result.steps) {
    expect(step.from).toBeGreaterThanOrEqual(0);
    expect(step.to).toBeLessThanOrEqual(100);
  }
});

it("does not imply that a raw contribution has a fixed probability-point value", () => {
  const a = explanation([1], -8);
  const b = explanation([1], -1);
  a.probability = scoreProbability(a.rawMargin);
  b.probability = scoreProbability(b.rawMargin);
  expect(probabilityWalkthrough(a).steps[0]!.change).toBeLessThan(
    probabilityWalkthrough(b).steps[0]!.change,
  );
  expect(() => probabilityWalkthrough({ ...a, probability: 99 })).toThrow(
    "calibration",
  );
});

it("keeps small probabilities informative and their displayed additions consistent", () => {
  const data = explanation([0.5, -0.1], -9.233);
  data.probability = scoreProbability(data.rawMargin);
  const result = probabilityWalkthrough(data);
  expect(result.precision).toBe(4);
  expect(result.steps.some((s) => s.displayChange !== 0)).toBe(true);
  const factor = 10 ** result.precision;
  expect(
    Math.round(result.start * factor) +
      result.steps.reduce(
        (sum, s) => sum + Math.round(s.displayChange * factor),
        0,
      ),
  ).toBe(Math.round(result.final * factor));
});

it("retains both signs and includes every omitted contribution in the final score", () => {
  const data = explanation([3, 2, 1, 0.8, 0.6, 0.4, -0.1, -0.05, 0]);
  const result = contributionBreakdown(data);
  expect(result.visible).toHaveLength(5);
  expect(result.visible.some((r) => r.contribution < 0)).toBe(true);
  expect(result.omitted).toBe(3);
  expect(result.other).toBeCloseTo(0.95);
  expect(result.steps.at(-1)!.to).toBeCloseTo(data.rawMargin, 10);
  for (let i = 1; i < result.steps.length; i++)
    expect(result.steps[i]!.from).toBe(result.steps[i - 1]!.to);
  expect(data.contributions[4]!.contribution).toBe(0.6);
});

it("keeps small increases small on a shared scale and includes intermediate extremes", () => {
  const tiny = contributionBreakdown(explanation([0.01], -0.02));
  expect(tiny.extent).toBe(10);
  expect(tiny.steps[0]!.to).toBeCloseTo(-0.01);
  const extremes = contributionBreakdown(explanation([50, -49], 1));
  expect(extremes.extent).toBeGreaterThanOrEqual(51);
  expect(extremes.steps.at(-1)!.to).toBe(2);
});

it("handles zero contributions, cancellation and tiny signs without false zeros", () => {
  expect(contributionBreakdown(explanation([0, 0])).steps).toEqual([]);
  const result = contributionBreakdown(
    explanation([7, -6, 5, -4, 3, 0.1, -0.1]),
  );
  expect(result.omitted).toBe(2);
  expect(result.other).toBe(0);
  expect(result.steps.at(-1)!.label).toBe("Other");
  expect(signedContribution(-0)).toBe("0.000");
  expect(signedContribution(0.00001)).toBe("+<0.001");
  expect(signedContribution(-0.00001)).toBe("−<0.001");
});

it("expands a large Other jump into every omitted factor without changing either total", () => {
  const data = explanation(
    [
      2,
      1.7,
      1.5,
      1.3,
      -0.6,
      ...Array.from({ length: 70 }, (_, i) => (i % 3 ? 0.25 : -0.1)),
    ],
    -9.2333,
  );
  data.probability = scoreProbability(data.rawMargin);
  const result = probabilityWalkthrough(data);
  const group = result.steps.at(-1)!;
  expect(group.label).toBe("Other");
  expect(group.change).toBeGreaterThan(90);
  expect(result.otherSteps).toHaveLength(70);
  expect(new Set(result.otherSteps.map((s) => s.feature)).size).toBe(70);
  expect(result.otherSteps.some((s) => s.value < 0)).toBe(true);
  expect(result.otherSteps[0]!.from).toBe(group.from);
  expect(result.otherSteps.at(-1)!.to).toBe(group.to);
  expect(result.otherSteps.reduce((sum, s) => sum + s.change, 0)).toBeCloseTo(
    group.change,
    10,
  );
  const factor = 10 ** result.precision;
  expect(
    result.otherSteps.reduce(
      (sum, s) => sum + Math.round(s.displayChange * factor),
      0,
    ),
  ).toBe(Math.round(group.displayChange * factor));
  for (let i = 1; i < result.otherSteps.length; i++)
    expect(result.otherSteps[i]!.from).toBe(result.otherSteps[i - 1]!.to);
  expect(
    result.visible.every(
      (r) => !result.otherSteps.some((s) => s.feature === r.feature),
    ),
  ).toBe(true);
});

it("can reveal opposing factors within a net-zero Other group and handle no remaining factors", () => {
  const data = explanation([7, -6, 5, -4, 3, 0.1, -0.1]);
  data.probability = scoreProbability(data.rawMargin);
  const result = probabilityWalkthrough(data);
  expect(result.otherSteps).toHaveLength(2);
  expect(result.otherSteps[0]!.change).toBeGreaterThan(0);
  expect(result.otherSteps[1]!.change).toBeLessThan(0);
  expect(result.otherSteps.reduce((sum, s) => sum + s.change, 0)).toBe(0);
  const empty = explanation([0, 0]);
  empty.probability = scoreProbability(empty.rawMargin);
  expect(probabilityWalkthrough(empty).otherSteps).toEqual([]);
});
