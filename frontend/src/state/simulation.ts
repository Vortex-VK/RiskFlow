import { unsupportedRankingInput } from "../domain/model";
import { create } from "zustand";
import type { Document } from "../domain/types";
import { freeze, projectAnalyticalInput } from "../domain/runs";
import type { DeepReadonly, Run } from "../domain/runs";
import {
  prepareSimulation,
  takePreparedSimulation,
  discardPreparation,
} from "../api/prepareSimulation";
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

export const useSimulation = create<SimulationState>((set, get) => ({
  latest: null,
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
    discardPreparation();
    set({
      latest: freeze({
        result: structuredClone(simulation),
        document: structuredClone(document),
        projection: projectAnalyticalInput(document.scenario),
        assessment: structuredClone(assessment),
      }),
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
    const missing = submitted.scenario.payments.filter(unsupportedRankingInput);
    if (!submitted.scenario.payments.length || missing.length) {
      set({
        error: missing.length
          ? `${missing.length} payments need stable merchant IDs and a supported purchase activity type. Reimport with these fields.`
          : "Add a payment before simulating.",
      });
      return;
    }
    const session = workspace.sessionId;
    const projection = projectAnalyticalInput(submitted.scenario);
    const token = ++generation;
    set({ pending: true, error: "", playing: false });
    const current = () =>
      token === generation &&
      session === useWorkspace.getState().sessionId &&
      !useWorkspace.getState().dirty;
    try {
      const result = await takePreparedSimulation(submitted);
      if (!result) return;
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
    discardPreparation(
      replacement && !useSimulation.getState().pending
        ? (next.document ?? undefined)
        : undefined,
    );
    useSimulation.setState({
      pending: false,
      playing: false,
      error: "",
      ...(replacement ? { latest: null, viewing: false, elapsed: 0 } : {}),
    });
  }
  if (replacement && next.document && !next.dirty) {
    // Let the imported graph paint before starting model work.
    const session = next.sessionId;
    setTimeout(() => {
      const current = useWorkspace.getState();
      if (
        current.sessionId === session &&
        current.document &&
        !current.dirty &&
        !useSimulation.getState().pending &&
        !useSimulation.getState().viewing
      )
        void prepareSimulation(current.document)?.catch(() => {});
    }, 0);
  }
});
