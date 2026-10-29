import { unsupportedRankingInput } from "../domain/model";
import type { Document } from "../domain/types";
import { normalizedScenario } from "../domain/runs";
import type { Run } from "../domain/runs";
import { decodeRun } from "./decodeRun";
import { requireModelService } from "./modelService";

type Preparation = {
  key: string;
  controller: AbortController;
  result: Promise<Run>;
};
let prepared: Preparation | null = null;

export async function takePreparedSimulation(
  document: Document,
): Promise<Run | null> {
  const result = prepareSimulation(document);
  try {
    return await result;
  } finally {
    if (prepared?.result === result) prepared = null;
  }
}

export function discardPreparation(document?: Document) {
  if (document && prepared?.key === normalizedScenario(document.scenario))
    return;
  prepared?.controller.abort();
  prepared = null;
}

// One in-memory draft only. Never changes playback, counters, or saved assessments.
export function prepareSimulation(document: Document): Promise<Run> | null {
  if (
    !document.scenario.payments.length ||
    document.scenario.payments.some(unsupportedRankingInput)
  )
    return null;
  const key = normalizedScenario(document.scenario);
  if (prepared?.key === key) return prepared.result;
  discardPreparation();
  const submitted = structuredClone(document);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(30000),
  ]);
  const result = (async () => {
    await requireModelService(signal);
    const response = await fetch("/api/v1/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: submitted.scenario }),
      signal,
    });
    if (!response.headers.get("content-type")?.startsWith("application/json"))
      throw new Error("The server returned an unexpected response. Try again.");
    const data: unknown = await response.json();
    if (!response.ok) {
      let message = `Simulation failed (${response.status}). Try again.`;
      if (
        (response.status === 422 ||
          response.status === 429 ||
          response.status === 503) &&
        data &&
        typeof data === "object" &&
        "error" in data
      ) {
        const error = data.error;
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        )
          message = error.message;
        if (
          error &&
          typeof error === "object" &&
          "issues" in error &&
          Array.isArray(error.issues)
        ) {
          const messages = error.issues.flatMap((issue: unknown) =>
            issue &&
            typeof issue === "object" &&
            "message" in issue &&
            typeof issue.message === "string"
              ? [
                  "path" in issue && typeof issue.path === "string"
                    ? `${issue.path}: ${issue.message}`
                    : issue.message,
                ]
              : [],
          );
          if (messages.length)
            message =
              messages.slice(0, 5).join(" ") +
              (messages.length > 5
                ? ` (${messages.length - 5} more issues.)`
                : "");
        }
      }
      throw new Error(message);
    }
    return decodeRun(data, submitted);
  })();
  const entry = { key, controller, result };
  prepared = entry;
  // Background failures are quiet and retryable; an awaiting Run still receives the error.
  void result.catch(() => {
    if (prepared === entry) prepared = null;
  });
  return result;
}
