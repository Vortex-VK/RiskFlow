import { list, object } from "./decode";
import type { components } from "./generated";
import type { StackExplanation } from "./stackExplanation";
import type { Scenario } from "../domain/types";
import { priorityComparison } from "../domain/rankingExplanation";
import spec from "../../../contracts/stack-spec.json";

export type StackComparison =
  components["schemas"]["StackComparisonExplanation"];
export type ComparativeCheck = StackComparison["checks"][number];

export function decodeStackComparison(
  value: unknown,
  selected: StackExplanation,
  reference: StackExplanation,
): StackComparison {
  const d = object(
    value,
    ["eventId", "referenceEventId", "modelBundleSha256", "method", "checks"],
    "payment comparison",
  );
  if (
    d.eventId !== selected.eventId ||
    d.referenceEventId !== reference.eventId ||
    d.modelBundleSha256 !== selected.modelBundleSha256 ||
    d.method !== "grouped-shapley-head-attribution-v1"
  )
    throw new Error("The comparison does not match these payments.");
  const expected = priorityComparison(selected, reference)
    .steps.slice(0, 4)
    .filter((s) => s.feature.startsWith("expert_"));
  const finite = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const observed = (v: unknown): v is string | number | null =>
    v === null || finite(v) || (typeof v === "string" && v.length < 240);
  const checks = list(d.checks, expected.length, "compared checks").map(
    (item, i) => {
      const check = object(
        item,
        ["feature", "contribution", "observations"],
        "compared check",
      );
      const parent = expected[i];
      if (
        !parent ||
        check.feature !== parent.feature ||
        !finite(check.contribution) ||
        Math.abs(check.contribution - parent.contribution) > 1e-6
      )
        throw new Error("The detailed points do not match this check.");
      const name = parent.feature.slice(7) as keyof typeof spec.expert_features;
      const features: readonly string[] = spec.expert_features[name];
      const observations = list(
        check.observations,
        4,
        "compared observations",
      ).map((item) => {
        const row = object(
          item,
          ["feature", "value", "referenceValue", "contribution"],
          "compared observation",
        );
        if (
          typeof row.feature !== "string" ||
          !(
            features.includes(row.feature) || row.feature === "other_context"
          ) ||
          !finite(row.contribution) ||
          !observed(row.value) ||
          !observed(row.referenceValue)
        )
          throw new Error("Invalid compared observation.");
        for (const [explanation, value] of [
          [selected, row.value],
          [reference, row.referenceValue],
        ] as const) {
          const recorded = explanation.experts
            .find((e) => e.expert === name)
            ?.contributions.find((c) => c.feature === row.feature);
          if (recorded && recorded.value !== value)
            throw new Error("The observation does not match this payment.");
        }
        return {
          feature: row.feature,
          value: row.value,
          referenceValue: row.referenceValue,
          contribution: row.contribution,
        };
      });
      if (
        !observations.length ||
        observations.at(-1)?.feature !== "other_context" ||
        observations.at(-1)?.value !== null ||
        observations.at(-1)?.referenceValue !== null ||
        new Set(observations.map((r) => r.feature)).size !==
          observations.length ||
        Math.abs(
          observations.reduce((sum, r) => sum + r.contribution, 0) -
            check.contribution,
        ) > 1e-6
      )
        throw new Error("The detailed points do not add up to this check.");
      return {
        feature: parent.feature,
        contribution: check.contribution,
        observations,
      };
    },
  );
  if (checks.length !== expected.length)
    throw new Error("Missing check comparisons.");
  return {
    eventId: selected.eventId,
    referenceEventId: reference.eventId,
    modelBundleSha256: selected.modelBundleSha256,
    method: "grouped-shapley-head-attribution-v1",
    checks,
  };
}

export async function fetchStackComparison(
  scenario: Scenario,
  selected: StackExplanation,
  reference: StackExplanation,
  signal: AbortSignal,
) {
  const response = await fetch("/api/v1/explanations/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      scenario,
      eventId: selected.eventId,
      referenceEventId: reference.eventId,
      modelBundleSha256: selected.modelBundleSha256,
      expectedRawMargin: selected.rawMargin,
      expectedReferenceRawMargin: reference.rawMargin,
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "The running backend needs an update. Restart RiskFlow, then retry."
        : response.status === 409
          ? "This comparison does not match the saved calculation. Run Simulate again."
          : "Comparison unavailable. Your ranking is unchanged.",
    );
  return decodeStackComparison(await response.json(), selected, reference);
}
