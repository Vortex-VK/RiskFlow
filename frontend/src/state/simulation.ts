import { create } from "zustand";
import type { Document } from "../domain/types";
import { freeze, projectAnalyticalInput } from "../domain/runs";
import type { DeepReadonly, Run } from "../domain/runs";
import { decodeRun } from "../api/decodeRun";
import { requireModelService } from "../api/modelService";
import { useWorkspace } from "./workspace";
import type { AssessmentRun } from "../api/decodeAssessment";

export type CapturedRun = DeepReadonly<{
  result: Run;
  document: Document;
  projection: string;
  assessment?: Omit<AssessmentRun, "document" | "simulation">;
}>;
interface SimulationState {
  latest: CapturedRun | null;
  previous: CapturedRun | null;
  pending: boolean;
  error: string;
  viewing: boolean;
  elapsed: number;
  playing: boolean;
  speed: number;
  run: () => Promise<void>;
  openAssessment: (run: AssessmentRun) => void;
  edit: () => void;
}
let generation = 0;
let controller: AbortController | null = null;

export const useSimulation = create<SimulationState>((set, get) => ({
  latest: null,
  previous: null,
  pending: false,
  error: "",
  viewing: false,
  elapsed: 0,
  playing: false,
  speed: 1,
  edit: () => set({ viewing: false, playing: false }),
  openAssessment: (run) => {
    if (!run.simulation) return;
    const { simulation, document, ...assessment } = run;
    generation++;
    controller?.abort();
    controller = null;
    set({
      latest: freeze({
        result: structuredClone(simulation),
        document: structuredClone(document),
        projection: projectAnalyticalInput(document.scenario),
        assessment: structuredClone(assessment),
      }),
      previous: null,
      pending: false,
      error: "",
      viewing: true,
      elapsed: 0,
      playing: true,
    });
  },
  run: async () => {
    const workspace = useWorkspace.getState();
    if (
      !workspace.document ||
      workspace.dirty ||
      workspace.dragging ||
      get().pending
    )
      return;
    const submitted = structuredClone(workspace.document);
    const missing = submitted.scenario.payments.filter((p) => !p.modelInput);
    if (!submitted.scenario.payments.length || missing.length) {
      set({
        error: missing.length
          ? `${missing.length} payments need precise time, transaction channel, four-digit MCC and completion status. Edit their payment details or reimport with these fields.`
          : "Add a payment before simulating.",
      });
      return;
    }
    const session = workspace.sessionId;
    const projection = projectAnalyticalInput(submitted.scenario);
    const token = ++generation;
    controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    set({ pending: true, error: "", playing: false });
    const current = () =>
      token === generation &&
      session === useWorkspace.getState().sessionId &&
      !useWorkspace.getState().dirty;
    try {
      await requireModelService(signal);
      if (!current()) return;
      const response = await fetch("/api/v1/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: submitted.scenario }),
        signal,
      });
      if (!response.headers.get("content-type")?.startsWith("application/json"))
        throw new Error(
          "The server returned an unexpected response. Try again.",
        );
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
      const result = decodeRun(data, submitted);
      if (!current()) return;
      const captured = freeze({
        result: structuredClone(result),
        document: {
          scenario: structuredClone(result.scenarioSnapshot),
          view: structuredClone(submitted.view),
        },
        projection,
      });
      set({
        previous: get().latest,
        latest: captured,
        viewing: true,
        elapsed: 0,
        playing: true,
      });
    } catch (error) {
      if (!current()) return;
      set({
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "Simulation timed out. Your draft and previous results are safe; try again."
            : error instanceof Error
              ? error.message
              : "Simulation failed. Try again.",
      });
    } finally {
      if (current()) {
        controller = null;
        set({ pending: false });
      }
    }
  },
}));

useWorkspace.subscribe((next, previous) => {
  const replacement = next.sessionId !== previous.sessionId;
  const becameDirty = next.dirty && !previous.dirty;
  const changed =
    next.document?.scenario !== previous.document?.scenario &&
    next.document &&
    previous.document &&
    projectAnalyticalInput(next.document.scenario) !==
      projectAnalyticalInput(previous.document.scenario);
  if (
    replacement ||
    becameDirty ||
    changed ||
    next.historyRevision !== previous.historyRevision
  ) {
    generation++;
    controller?.abort();
    controller = null;
    useSimulation.setState({
      pending: false,
      playing: false,
      error: "",
      ...(replacement
        ? { latest: null, previous: null, viewing: false, elapsed: 0 }
        : {}),
    });
  }
});
