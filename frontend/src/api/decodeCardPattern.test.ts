import { expect, it } from "vitest";
import { decodeCardPattern } from "./decodeCardPattern";
import { decodeRun } from "./decodeRun";
import { decodeDocument } from "./decode";
import current from "../../../fixtures/runtime/upload-v8-compatibility-run.json";
import template from "../../../fixtures/scenarios/stolen-card-burst.json";
import retained from "../../../fixtures/runtime/card-pattern-assessment-v8.json";
import { decodeAssessment } from "./decodeAssessment";

const review = {
  version: "card-pattern-v1",
  scope: "review_only",
  bundleSha256: "a".repeat(64),
  margin: 1,
  threshold: 0,
  historyCount: 12,
  priorHourAttempts: 3,
  amountPercentile: 0.99,
  observations: ["12 prior purchases.", "3 prior attempts."],
  modelDecisionChanged: false,
  probabilityAvailable: false,
};

it("preserves retained review evidence and rejects mismatches with its simulation", () => {
  const run = decodeAssessment(retained);
  expect(run.assessments.filter((item) => item.cardPattern)).toHaveLength(4);
  const changed = structuredClone(retained);
  const item = changed.assessments.find((a) => a.cardPattern)!;
  item.cardPattern!.observations[0] = "Altered evidence";
  expect(() => decodeAssessment(changed)).toThrow("card-pattern result");
});

it("decodes experimental reviews without treating them as probabilities", () => {
  expect(decodeCardPattern(review)).toEqual(review);
  expect(decodeCardPattern(undefined)).toBeNull();
  for (const bad of [
    { scope: "fraud" },
    { probabilityAvailable: true },
    { modelDecisionChanged: true },
    { margin: -1 },
    { historyCount: 1 },
    { amountPercentile: 1.2 },
    { observations: [] },
    { bundleSha256: "bad" },
  ]) {
    expect(() => decodeCardPattern({ ...review, ...bad })).toThrow();
  }
});

it("validates the second model's priority without changing the original lead", () => {
  const priority = {
    version: "card-pattern-v2",
    level: "prioritized",
    margin: 1,
    threshold: 0,
  };
  const current = { ...review, version: "card-pattern-v5", priority };
  expect(decodeCardPattern(current)).toEqual(current);
  expect(
    decodeCardPattern({
      ...current,
      priority: { ...priority, level: "exploratory", margin: -1 },
    }),
  ).toBeTruthy();
  for (const bad of [
    null,
    { ...priority, level: "exploratory" },
    { ...priority, margin: NaN },
    { ...priority, version: "unknown" },
  ]) {
    expect(() => decodeCardPattern({ ...current, priority: bad })).toThrow();
  }
  expect(() => decodeCardPattern({ ...review, priority })).toThrow();
});

it("rejects reviews attached to unsupported events or inconsistent histories", () => {
  const document = decodeDocument({
    scenario: current.scenarioSnapshot,
    view: template.view,
  });
  const invalid = structuredClone(current);
  Object.assign(invalid.events[0]!, { cardPattern: review });
  expect(() => decodeRun(invalid, document)).toThrow();
  expect(() => decodeRun(current, document)).not.toThrow();
});
