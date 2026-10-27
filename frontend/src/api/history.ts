import type { components } from "./generated";
import { list, decodeDocument } from "./decode";
import { requireModelService } from "./modelService";
import {
  decodeAssessment,
  decodeDataset,
  decodeEventPage,
  decodePreview,
  decodeRunSummary,
} from "./decodeAssessment";

async function request(path: string, payload?: unknown): Promise<unknown> {
  const response = await fetch(`/api/v2/datasets${path}`, {
    ...(payload === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("The service returned an unexpected response format.");
  const data: unknown = await response.json();
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data ? data.error : null;
    const message =
      error && typeof error === "object" && "message" in error
        ? error.message
        : null;
    throw new Error(
      typeof message === "string"
        ? message
        : `History request failed (${response.status}).`,
    );
  }
  return data;
}

const path = (id: string) => `/${encodeURIComponent(id)}`;

export const historyApi = {
  list: async () =>
    list(await request(""), 10000, "datasets").map(decodeDataset),
  create: async (name: string, sourceNamespace: string) =>
    decodeDataset(await request("", { name, sourceNamespace })),
  get: async (id: string) => decodeDataset(await request(path(id))),
  preview: async (id: string, upload: components["schemas"]["ImportRequest"]) =>
    decodePreview(await request(`${path(id)}/imports/preview`, upload)),
  commit: async (id: string, preview: string) =>
    decodePreview(
      await request(
        `${path(id)}/imports/${encodeURIComponent(preview)}/commit`,
        {},
      ),
    ),
  resolve: async (
    id: string,
    preview: string,
    resolution: components["schemas"]["CorrectionRequest"],
  ) =>
    decodePreview(
      await request(
        `${path(id)}/imports/${encodeURIComponent(preview)}/resolve`,
        resolution,
      ),
    ),
  versions: async (id: string, event: string, revision: number, offset = 0) =>
    decodeEventPage(
      await request(
        `${path(id)}/events/${encodeURIComponent(event)}/versions?revision=${revision}&offset=${offset}&limit=50`,
      ),
      true,
    ),
  events: async (id: string, revision: number, offset = 0) =>
    decodeEventPage(
      await request(
        `${path(id)}/events?revision=${revision}&offset=${offset}&limit=50`,
      ),
    ),
  document: async (id: string, revision: number) =>
    decodeDocument(await request(`${path(id)}/document?revision=${revision}`)),
  assess: async (
    id: string,
    revision: number,
    knowledgeCutoff?: string,
    analysisMode: "model" | "behavioral" = "model",
  ) => {
    if (analysisMode === "model") await requireModelService();
    else {
      const response = await fetch("/api/v2/analysis-capabilities", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("application/json")
      )
        throw new Error(
          "Behavioral analysis is unavailable. Restart the backend and retry.",
        );
      const capabilities: unknown = await response.json();
      if (
        !capabilities ||
        typeof capabilities !== "object" ||
        !("version" in capabilities) ||
        capabilities.version !== "analysis-capabilities-v1" ||
        !("behavioralVersion" in capabilities) ||
        capabilities.behavioralVersion !== "behavioral-features-v1" ||
        !("retainedModes" in capabilities) ||
        !Array.isArray(capabilities.retainedModes) ||
        !capabilities.retainedModes.includes("behavioral")
      )
        throw new Error(
          "This backend does not support behavioral observations. Restart it and retry.",
        );
    }
    return decodeAssessment(
      await request(`${path(id)}/runs`, {
        revision,
        mode: knowledgeCutoff ? "as_known" : "retrospective",
        knowledgeCutoff: knowledgeCutoff ?? null,
        analysisMode,
      }),
    );
  },
  runs: async (id: string) =>
    list(await request(`${path(id)}/runs`), 10000, "saved runs").map(
      decodeRunSummary,
    ),
  run: async (id: string, runId: string) =>
    decodeAssessment(
      await request(`${path(id)}/runs/${encodeURIComponent(runId)}`),
    ),
};
