import { expect, it } from "vitest";
import { decodeScore, decodeCardScores } from "./decodeScores";
import spec from "../../../contracts/score-spec.json";
import { decodeModel } from "./decodeModel";
import current from "../../../fixtures/runtime/upload-v8-compatibility-run.json";
import probabilities from "../../../contracts/probability-spec.json";

function score(source: keyof typeof spec.thresholds, delta = 0) {
  const threshold = spec.thresholds[source];
  const margin = threshold + delta;
  const distance = margin - threshold;
  return {
    version: spec.version,
    source,
    value: 100 / (1 + Math.exp(-distance)),
    rawMargin: margin,
    referenceThreshold: threshold,
    distance,
    referenceValue: 50,
    probabilityAvailable: false,
  };
}

it("rejects forged scores, unversioned cutoffs and probability claims", () => {
  const s = score("coverage");
  expect(decodeScore(s)).toEqual(s);
  for (const bad of [
    { value: 0 },
    { rawMargin: NaN },
    { distance: 1 },
    { referenceThreshold: 0 },
    { probabilityAvailable: true },
    { version: "unknown" },
    { source: "other" },
  ])
    expect(() => decodeScore({ ...s, ...bad })).toThrow();
});

it("accepts trained probabilities with their own reference cutoff and rejects forged calibration", () => {
  const source = "coverage",
    map = probabilities.sources[source];
  const rawMargin = map.raw_cutoff;
  const s = {
    version: probabilities.version,
    source,
    rawMargin,
    referenceThreshold: map.raw_cutoff,
    distance: 0,
    value: map.reference_probability * 100,
    referenceValue: map.reference_probability * 100,
    probabilityAvailable: true,
    probabilityBundleSha256: probabilities.bundle_sha256,
    calibrationScope: "ibm_synthetic",
  };
  expect(decodeScore(s)).toEqual(s);
  expect(s.referenceValue).not.toBe(50);
  for (const bad of [
    { referenceValue: 50 },
    { value: 50 },
    { probabilityAvailable: false },
    { probabilityBundleSha256: "a".repeat(64) },
    { calibrationScope: "real_world" },
    { version: "margin-index-v1" },
  ])
    expect(() => decodeScore({ ...s, ...bad })).toThrow();
  expect(() =>
    decodeModel({ ...current.events[0]!.model, probabilityAvailable: true }),
  ).toThrow();
});

it("allows scores below the specialist cutoff and rejects inconsistent priority flags", () => {
  const scores = {
    version: "card-scores-v1",
    bundleSha256: "a".repeat(64),
    historyCount: 10,
    pattern: score("card_pattern", -1),
    priority: score("card_priority", 1),
    reviewSuggested: false,
    prioritized: false,
  };
  expect(decodeCardScores(scores)).toEqual(scores);
  expect(() => decodeCardScores({ ...scores, prioritized: true })).toThrow();
  expect(() => decodeCardScores({ ...scores, historyCount: 9 })).toThrow();
  expect(decodeCardScores(undefined)).toBeNull();
});

it("preserves historical models and requires scores to match their raw evidence", () => {
  const model = current.events[0]!.model!;
  expect(decodeModel(model)).toEqual(model);
  const s = score(
    "coverage",
    model.rawScores.coverage! - spec.thresholds.coverage,
  );
  s.rawMargin = model.rawScores.coverage!;
  expect(decodeModel({ ...model, score: s })).toBeTruthy();
  expect(() =>
    decodeModel({ ...model, score: score("coverage", 100) }),
  ).toThrow();
});
