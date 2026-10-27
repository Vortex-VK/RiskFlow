import { list, object } from "./decode";
import type { components } from "./generated";
import type { DeepReadonly, EventResult } from "../domain/runs";
import type { Scenario } from "../domain/types";
import adaptation from "../../../contracts/adaptation-spec.json";
import { scoreProbability } from "../domain/contributionBreakdown";

export type PaymentExplanation = components["schemas"]["PaymentExplanation"];

export function decodeExplanation(
  value: unknown,
  event: DeepReadonly<EventResult>,
): PaymentExplanation {
  const data = object(
    value,
    [
      "eventId",
      "modelBundleSha256",
      "method",
      "baseValue",
      "rawMargin",
      "probability",
      "contributions",
    ],
    "model explanation",
  );
  const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
  const score = event.model?.score;
  const contributions = list(
    data.contributions,
    adaptation.features.length,
    "contributions",
  ).map((item) => {
    const row = object(
      item,
      ["feature", "value", "contribution"],
      "contribution",
    );
    if (
      typeof row.feature !== "string" ||
      !finite(row.contribution) ||
      !(
        row.value === null ||
        typeof row.value === "string" ||
        finite(row.value)
      )
    )
      throw new Error("Invalid model contribution.");
    return {
      feature: row.feature,
      value: row.value,
      contribution: row.contribution,
    };
  });
  if (
    !score ||
    event.model?.version !== "ml-upload-v9" ||
    data.eventId !== event.eventId ||
    data.modelBundleSha256 !== event.model.bundleSha256 ||
    data.modelBundleSha256 !== adaptation.bundle_sha256 ||
    data.method !== "tree-shap-final-head-v1" ||
    !finite(data.baseValue) ||
    !finite(data.rawMargin) ||
    !finite(data.probability) ||
    !close(data.rawMargin, score.rawMargin) ||
    !close(data.probability, score.value) ||
    !close(data.probability, scoreProbability(data.rawMargin)) ||
    contributions.length !== adaptation.features.length ||
    contributions.some((row, i) => row.feature !== adaptation.features[i]) ||
    !close(
      data.baseValue +
        contributions.reduce((sum, row) => sum + row.contribution, 0),
      data.rawMargin,
    )
  )
    throw new Error(
      "The explanation does not match this payment's saved prediction.",
    );
  return {
    eventId: data.eventId,
    modelBundleSha256: data.modelBundleSha256,
    method: data.method,
    baseValue: data.baseValue,
    rawMargin: data.rawMargin,
    probability: data.probability,
    contributions,
  };
}

export async function fetchExplanation(
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
      expectedRawMargin: event.model?.score?.rawMargin,
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "The original model and complete assessment history are needed to explain this saved result."
        : "The explanation could not be loaded. Your score and review decision are unchanged.",
    );
  return decodeExplanation(await response.json(), event);
}
