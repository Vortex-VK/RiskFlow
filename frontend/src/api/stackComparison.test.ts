import { expect, it } from "vitest";
import { decodeStackComparison } from "./stackComparison";
import { decodeStackExplanation } from "./stackExplanation";
import { priorityComparison } from "../domain/rankingExplanation";
import explanation from "../../../fixtures/runtime/stack-d5/explanation.json";
import run from "../../../fixtures/runtime/stack-d5/run.json";
import type { EventResult } from "../domain/runs";

const event = run.events.find(
  (e) => e.eventId === explanation.eventId,
)! as EventResult;
const selected = decodeStackExplanation(explanation, event);
const reference = {
  ...selected,
  eventId: "middle",
  rawMargin: selected.rawMargin - 1,
  contributions: selected.contributions.map((r) => ({
    ...r,
    contribution: r.contribution - (r.feature === "expert_rich" ? 1 : 0),
  })),
};
const valid = {
  eventId: selected.eventId,
  referenceEventId: reference.eventId,
  modelBundleSha256: selected.modelBundleSha256,
  method: "grouped-shapley-head-attribution-v1",
  checks: priorityComparison(selected, reference)
    .steps.slice(0, 4)
    .filter((r) => r.feature.startsWith("expert_"))
    .map((r) => ({
      feature: r.feature,
      contribution: r.contribution,
      observations: [
        {
          feature: "other_context",
          value: null,
          referenceValue: null,
          contribution: r.contribution,
        },
      ],
    })),
};

it("accepts reconciled grouped comparisons and rejects wrong identities, incomplete or altered sums", () => {
  expect(decodeStackComparison(valid, selected, reference)).toEqual(valid);
  for (const patch of [
    { eventId: "wrong" },
    { referenceEventId: "wrong" },
    { modelBundleSha256: "0".repeat(64) },
    { method: "native-expert-shap" },
    { checks: [] },
  ])
    expect(() =>
      decodeStackComparison({ ...valid, ...patch }, selected, reference),
    ).toThrow();
  for (const mutate of [
    (v: typeof valid) => {
      v.checks[0]!.contribution += 1;
    },
    (v: typeof valid) => {
      v.checks[0]!.observations[0]!.contribution += 1;
    },
    (v: typeof valid) => {
      v.checks[0]!.observations[0]!.contribution = NaN;
    },
    (v: typeof valid) => {
      v.checks[0]!.observations[0]!.feature = "fake_observation";
    },
    (v: typeof valid) => {
      v.checks[0]!.observations = [];
    },
    (v: typeof valid) => {
      v.checks[0]!.observations.push(v.checks[0]!.observations[0]!);
    },
  ]) {
    const broken = structuredClone(valid);
    mutate(broken);
    expect(() => decodeStackComparison(broken, selected, reference)).toThrow();
  }
});
