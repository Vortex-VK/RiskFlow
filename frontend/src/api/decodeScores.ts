import { integer, object } from "./decode";
import type { components } from "./generated";
import spec from "../../../contracts/score-spec.json";
import probabilities from "../../../contracts/probability-spec.json";
import adaptation from "../../../contracts/adaptation-spec.json";

export type EvidenceScore = components["schemas"]["EvidenceScore"];
export function decodeScore(value: unknown): EvidenceScore {
  const score = object(
    value,
    [
      "version",
      "source",
      "value",
      "rawMargin",
      "referenceThreshold",
      "distance",
      "referenceValue",
      "probabilityAvailable",
      "probabilityBundleSha256",
      "calibrationScope",
    ],
    "continuous model score",
  );
  if (score.version === adaptation.score_version) {
    if (score.source !== "adapted_card" && score.source !== "adapted_online")
      throw new Error("Invalid adaptation score source.");
    const mapping = adaptation.sources[score.source];
    for (const key of [
      "value",
      "rawMargin",
      "referenceThreshold",
      "distance",
      "referenceValue",
    ])
      if (typeof score[key] !== "number" || !Number.isFinite(score[key]))
        throw new Error("Invalid adaptation score.");
    const s = score as EvidenceScore;
    const z = Math.max(
      -35,
      Math.min(35, mapping.slope * s.rawMargin + mapping.intercept),
    );
    const expected = 100 / (1 + Math.exp(-z));
    if (
      s.probabilityAvailable !== true ||
      s.calibrationScope !== "ibm_authored_synthetic" ||
      s.probabilityBundleSha256 !== adaptation.bundle_sha256 ||
      s.referenceThreshold !== mapping.raw_cutoff ||
      s.referenceValue !== 100 * mapping.reference_probability ||
      s.value < 0 ||
      s.value > 100 ||
      Math.abs(s.value - expected) > 1e-10 ||
      Math.abs(s.distance - (s.rawMargin - s.referenceThreshold)) > 1e-10
    )
      throw new Error("Inconsistent adaptation score.");
    return s;
  }
  if (
    ![spec.version, probabilities.version].includes(String(score.version)) ||
    typeof score.source !== "string" ||
    !Object.hasOwn(spec.thresholds, score.source) ||
    typeof score.referenceValue !== "number" ||
    !Number.isFinite(score.referenceValue)
  )
    throw new Error("Invalid score identity.");
  for (const key of ["value", "rawMargin", "referenceThreshold", "distance"])
    if (typeof score[key] !== "number" || !Number.isFinite(score[key]))
      throw new Error("Invalid continuous score.");
  const s = score as EvidenceScore;
  const expected = s.rawMargin - s.referenceThreshold;
  const isProbability = s.version === probabilities.version;
  const source = s.source as keyof typeof probabilities.sources;
  const mapping = probabilities.sources[source];
  const logistic = (z: number) =>
    z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  const p = Math.max(
    probabilities.epsilon,
    Math.min(
      1 - probabilities.epsilon,
      logistic(mapping.slope * s.rawMargin + mapping.intercept),
    ),
  );
  const v = isProbability
    ? 100 * p
    : expected >= 0
      ? 100 / (1 + Math.exp(-expected))
      : (100 * Math.exp(expected)) / (1 + Math.exp(expected));
  if (
    s.value < 0 ||
    s.value > 100 ||
    s.probabilityAvailable !== isProbability ||
    s.referenceValue !==
      (isProbability ? 100 * mapping.reference_probability : 50) ||
    (isProbability
      ? s.probabilityBundleSha256 !== probabilities.bundle_sha256 ||
        s.calibrationScope !== "ibm_synthetic"
      : s.probabilityBundleSha256 != null || s.calibrationScope != null) ||
    Math.abs(s.distance - expected) > 1e-10 ||
    Math.abs(s.value - v) > 1e-10 ||
    s.referenceThreshold !== spec.thresholds[source]
  )
    throw new Error("Inconsistent continuous score.");
  return s;
}

export function decodeCardScores(
  value: unknown,
): components["schemas"]["CardPatternScores"] | null {
  if (value == null) return null;
  const scores = object(
    value,
    [
      "version",
      "bundleSha256",
      "pattern",
      "priority",
      "historyCount",
      "reviewSuggested",
      "prioritized",
    ],
    "card scores",
  );
  if (
    scores.version !== "card-scores-v1" ||
    typeof scores.bundleSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(scores.bundleSha256) ||
    typeof scores.reviewSuggested !== "boolean" ||
    typeof scores.prioritized !== "boolean"
  )
    throw new Error("Invalid card scores.");
  integer(scores.historyCount, 10, 20000, "card score history");
  const pattern = decodeScore(scores.pattern),
    priority = decodeScore(scores.priority);
  if (
    pattern.source !== "card_pattern" ||
    priority.source !== "card_priority" ||
    scores.prioritized !== (scores.reviewSuggested && priority.distance >= 0)
  )
    throw new Error("Inconsistent card priority score.");
  return scores as components["schemas"]["CardPatternScores"];
}
