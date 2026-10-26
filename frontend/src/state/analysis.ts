import { create } from "zustand";
import type { AssessmentRun } from "../api/decodeAssessment";

interface AnalysisState {
  datasetId: string | null;
  run: AssessmentRun | null;
}

export const useAnalysis = create<AnalysisState>(() => ({
  datasetId: null,
  run: null,
}));
