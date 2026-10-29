import { expect, it } from "vitest";
import current from "../../../fixtures/runtime/stack-d5/assessment.json";
import legacy from "../../../fixtures/runtime/card-pattern-assessment-v9.json";
import { decodeAssessment } from "./decodeAssessment";
import { decodeModel } from "./decodeModel";

it("decodes the new stack and keeps legacy probability assessments readable", () => {
  const run = decodeAssessment(current);
  expect(run.assessmentVersion).toBe("assessment-v2.10");
  expect(
    run.simulation!.events.every(
      (e) => e.model?.ranking && !e.model.probabilityAvailable,
    ),
  ).toBe(true);
  expect(
    decodeAssessment(legacy).simulation!.events[0]!.model!.score,
  ).not.toBeNull();
});

it("rejects probability claims, unknown bundles and inconsistent queues in stack evidence", () => {
  const model = current.simulation.events[0]!.model;
  for (const patch of [
    { probabilityAvailable: true },
    { bundleSha256: "0".repeat(64) },
    { ranking: { ...model.ranking, reviewFraction: 0.05 } },
    { ranking: { ...model.ranking, rawMargin: model.ranking.rawMargin + 1 } },
    { detectionPaths: model.alert ? [] : ["review_queue"] },
  ])
    expect(() => decodeModel({ ...model, ...patch })).toThrow();
});
