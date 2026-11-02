import type { Payment } from "./types";

export const isLearnedEngine = (version: string) =>
  version === "engine-ml-v13" ||
  version === "engine-ml-upload-v5" ||
  version === "engine-ml-upload-v7" ||
  version === "engine-ml-upload-v8" ||
  version === "engine-ml-upload-v9" ||
  version === "engine-ml-stack-d5";

// Saved assessments can contain model names in explanatory text. Keep their
// original records intact while presenting product wording in the interface.
export const assessmentText = (text: string) =>
  text.replace(/\b(?:Upload-v\d+|V13)\b/gi, "RiskFlow");

export const unsupportedRankingInput = (payment: Payment) => {
  const input = payment.rankingInput;
  return (
    !!input &&
    (!input.merchantIdProvided ||
      !["purchase", "charge", "authorization"].includes(input.activityType))
  );
};
