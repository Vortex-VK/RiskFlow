import { list, object } from "./decode";
import type { components } from "./generated";
import type { DeepReadonly, EventResult } from "../domain/runs";
import type { Scenario } from "../domain/types";
import spec from "../../../contracts/stack-spec.json";

export type StackExplanation = components["schemas"]["StackPaymentExplanation"];

export function decodeStackExplanation(
  value: unknown,
  event: DeepReadonly<EventResult>,
): StackExplanation {
  const d = object(
    value,
    [
      "eventId",
      "modelBundleSha256",
      "method",
      "baseValue",
      "rawMargin",
      "contributions",
      "facts",
      "experts",
    ],
    "ranking explanation",
  );
  const finite = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
  const contributions = list(
    d.contributions,
    spec.explanation_features.length,
    "contributions",
  ).map((item, i) => {
    const row = object(
      item,
      ["feature", "value", "contribution"],
      "contribution",
    );
    if (
      row.feature !== spec.explanation_features[i] ||
      !finite(row.contribution) ||
      !(row.value === null || finite(row.value))
    )
      throw new Error("Invalid ranking contribution.");
    return {
      feature: row.feature as string,
      value: row.value,
      contribution: row.contribution,
    };
  });
  const facts = list(d.facts, 4, "observed comparisons").map((item) => {
    const row = object(item, ["label", "value", "comparison"], "comparison");
    if (
      ![row.label, row.value, row.comparison].every(
        (v) => typeof v === "string" && v.length > 0 && v.length < 240,
      )
    )
      throw new Error("Invalid observed comparison.");
    return {
      label: row.label as string,
      value: row.value as string,
      comparison: row.comparison as string,
    };
  });
  const experts = list(d.experts, 2, "component explanations").map((item) => {
    const expert = object(
      item,
      ["expert", "baseValue", "rawMargin", "contributions"],
      "component explanation",
    );
    if (
      typeof expert.expert !== "string" ||
      !Object.hasOwn(spec.expert_features, expert.expert) ||
      !finite(expert.baseValue) ||
      !finite(expert.rawMargin)
    )
      throw new Error("Invalid component explanation.");
    const name = expert.expert as keyof typeof spec.expert_features;
    const features = spec.expert_features[name];
    const parts = list(
      expert.contributions,
      features.length,
      "component contributions",
    ).map((item, i) => {
      const part = object(
        item,
        ["feature", "value", "contribution"],
        "component contribution",
      );
      if (
        part.feature !== features[i] ||
        !finite(part.contribution) ||
        !(
          part.value === null ||
          finite(part.value) ||
          (typeof part.value === "string" && part.value.length < 240)
        )
      )
        throw new Error("Invalid component contribution.");
      return {
        feature: features[i]!,
        value: part.value,
        contribution: part.contribution,
      };
    });
    const recorded = event.model?.rawScores[name];
    if (
      !finite(recorded) ||
      !close(recorded, expert.rawMargin) ||
      parts.length !== features.length ||
      !close(
        expert.baseValue + parts.reduce((sum, p) => sum + p.contribution, 0),
        expert.rawMargin,
      )
    )
      throw new Error(
        "Component explanation does not match the recorded score.",
      );
    return {
      expert: name,
      baseValue: expert.baseValue,
      rawMargin: expert.rawMargin,
      contributions: parts,
    };
  });
  if (experts.length !== 2 || new Set(experts.map((e) => e.expert)).size !== 2)
    throw new Error("Invalid component explanations.");
  if (
    !event.model?.ranking ||
    d.eventId !== event.eventId ||
    d.modelBundleSha256 !== spec.bundle_sha256 ||
    d.modelBundleSha256 !== event.model.bundleSha256 ||
    d.method !== "tree-shap-stack-head-v1" ||
    !finite(d.baseValue) ||
    !finite(d.rawMargin) ||
    !close(d.rawMargin, event.model.ranking.rawMargin) ||
    contributions.length !== spec.explanation_features.length ||
    !close(
      d.baseValue +
        contributions.reduce((sum, row) => sum + row.contribution, 0),
      d.rawMargin,
    )
  )
    throw new Error("The explanation does not match this payment.");
  return {
    eventId: d.eventId,
    modelBundleSha256: d.modelBundleSha256,
    method: d.method,
    baseValue: d.baseValue,
    rawMargin: d.rawMargin,
    contributions,
    facts,
    experts,
  };
}

export async function fetchStackExplanation(
  scenario: Scenario,
  event: DeepReadonly<EventResult>,
  signal: AbortSignal,
) {
  const response = await fetch("/api/v1/explanations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      scenario,
      eventId: event.eventId,
      modelBundleSha256: event.model?.bundleSha256,
      expectedRawMargin: event.model?.ranking?.rawMargin,
    }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: unknown };
    } | null;
    const message = error?.error?.message;
    const oldBackend =
      response.status === 409 &&
      typeof message === "string" &&
      message.includes("different model version");
    throw new Error(
      oldBackend
        ? "The running backend needs an update. Restart RiskFlow, then retry."
        : response.status === 409
          ? "This explanation does not match the saved calculation. Run Simulate again."
          : "Explanation unavailable. Your ranking is unchanged.",
    );
  }
  return decodeStackExplanation(await response.json(), event);
}
