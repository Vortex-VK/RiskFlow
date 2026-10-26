import { expect, it } from "vitest";
import retained from "../../../fixtures/runtime/card-pattern-assessment-v9.json";
import { decodeAssessment } from "./decodeAssessment";
import { decodeModel } from "./decodeModel";
import { decodeScore } from "./decodeScores";

it("preserves V9 probabilities and decisions in a retained assessment", () => {
  const run = decodeAssessment(retained);
  expect(run.assessmentVersion).toBe("assessment-v2.9");
  expect(run.simulation?.engineVersion).toBe("engine-ml-upload-v9");
  expect(run.assessments.filter((a) => a.model?.alert)).toHaveLength(10);
  for (const event of run.simulation!.events) {
    expect(event.model?.score?.version).toBe("fraud-probability-v2");
    expect(event.model?.alert).toBe(
      event.model!.score!.value >= event.model!.score!.referenceValue,
    );
  }
});

it("rejects altered V9 calibration, score scope, decisions and model identity", () => {
  const model = retained.simulation!.events[0]!.model!;
  const score = model.score!;
  expect(decodeScore(score)).toEqual(score);
  for (const changed of [
    { value: 100 },
    { calibrationScope: "ibm_synthetic" },
    { source: "coverage" },
    { referenceValue: 90 },
    { probabilityBundleSha256: "a".repeat(64) },
    { probabilityAvailable: false },
    { referenceThreshold: 0 },
  ])
    expect(() => decodeScore({ ...score, ...changed })).toThrow();
  for (const changed of [
    { alert: !model.alert },
    { version: "ml-upload-v8" },
    { score: null },
    { bundleSha256: "a".repeat(64) },
  ])
    expect(() => decodeModel({ ...model, ...changed })).toThrow();
});
