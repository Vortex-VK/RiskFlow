import { integer, list, object, text } from "./decode";
import type { components } from "./generated";
import { decodeScore } from "./decodeScores";
import adaptation from "../../../contracts/adaptation-spec.json";

export function decodeModel(
  value: unknown,
): components["schemas"]["ModelEvaluation"] {
  const model = object(
    value,
    [
      "version",
      "policy",
      "bundleSha256",
      "alert",
      "rawScores",
      "detectionPaths",
      "historyCount",
      "feedbackAvailable",
      "evidenceScope",
      "uploadDomainValidated",
      "probabilityAvailable",
      "score",
    ],
    "model evaluation",
  );
  const sequence = model.version === "ml-upload-v5";
  const coverage = model.version === "ml-upload-v7";
  const precision = model.version === "ml-upload-v8";
  const adapted = model.version === "ml-upload-v9";
  if (
    (!sequence &&
      !coverage &&
      !precision &&
      !adapted &&
      model.version !== "ml-v13") ||
    model.policy !==
      (adapted
        ? "mixed-source"
        : precision
          ? "precision95"
          : coverage
            ? "balanced"
            : sequence
              ? "recall85"
              : "depth6") ||
    typeof model.alert !== "boolean" ||
    model.feedbackAvailable !== false ||
    (model.evidenceScope !== undefined &&
      model.evidenceScope !== "synthetic_benchmark") ||
    (model.uploadDomainValidated !== undefined &&
      model.uploadDomainValidated !== false) ||
    (model.probabilityAvailable !== undefined &&
      typeof model.probabilityAvailable !== "boolean") ||
    typeof model.bundleSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(model.bundleSha256)
  )
    throw new Error("Invalid model identity.");
  const scoreKeys = ["baseline", "cb", "online_cb", "online_ebm", "depth6"];
  if (sequence) scoreKeys.push("base_margin", "sequence");
  if (coverage || precision || adapted)
    scoreKeys.push("base_margin", "coverage");
  if (precision || adapted) scoreKeys.push("online_specialist");
  if (adapted) scoreKeys.push("adapted_card", "adapted_online");
  const scores = object(model.rawScores, scoreKeys, "model margins");
  for (const key of scoreKeys) {
    const score = scores[key];
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      Math.abs(score) > 1000
    )
      throw new Error("Invalid model margin.");
  }
  integer(model.historyCount, 0, 20000, "history count");
  const paths = list(model.detectionPaths, 4, "detection paths");
  for (const path of paths) {
    text(path, "detection path");
    if (
      !(
        adapted
          ? ["adapted_card", "adapted_online"]
          : precision
            ? ["coverage", "online_specialist"]
            : coverage
              ? ["coverage", "retained_online"]
              : sequence
                ? ["sequence", "retained_online"]
                : [
                    "recent_model",
                    "corroborated_history",
                    "online_history",
                    "online_depth6",
                  ]
      ).includes(path)
    )
      throw new Error("Unknown detection path.");
  }
  if (new Set(paths).size !== paths.length || model.alert !== paths.length > 0)
    throw new Error("Inconsistent model alert.");
  if (model.score != null) {
    const score = decodeScore(model.score);
    if (
      (!precision && !adapted) ||
      !(
        adapted
          ? ["adapted_card", "adapted_online"]
          : ["coverage", "online_specialist"]
      ).includes(score.source) ||
      score.rawMargin !== scores[score.source] ||
      (model.probabilityAvailable ?? false) !== score.probabilityAvailable ||
      model.alert !==
        (adapted ? score.value >= score.referenceValue : score.distance >= 0) ||
      (adapted &&
        (score.version !== "fraud-probability-v2" ||
          model.bundleSha256 !== adaptation.bundle_sha256 ||
          paths.some((path) => path !== score.source)))
    )
      throw new Error("Inconsistent model score.");
  } else if (model.probabilityAvailable === true || adapted)
    throw new Error("Missing probability estimate.");
  return {
    ...model,
    evidenceScope: "synthetic_benchmark",
    uploadDomainValidated: false,
    probabilityAvailable: model.probabilityAvailable ?? false,
  } as components["schemas"]["ModelEvaluation"];
}
