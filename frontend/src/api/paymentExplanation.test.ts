import { expect, it } from "vitest";
import retained from "../../../fixtures/runtime/card-pattern-assessment-v9.json";
import adaptation from "../../../contracts/adaptation-spec.json";
import { decodeAssessment } from "./decodeAssessment";
import { decodeExplanation } from "./paymentExplanation";
import {
  featureLabels,
  observedFeature,
} from "../features/simulation/explanationLabels";

const event = decodeAssessment(retained).simulation!.events[0]!;
it("distinguishes an absent change from unavailable evidence", () => {
  expect(observedFeature("previous_state_changed", 0)).toBe("Observed: no");
  expect(observedFeature("previous_state_changed", 1)).toBe("Observed: yes");
  expect(observedFeature("previous_state_changed", null)).toContain(
    "Unavailable",
  );
});
it("presents measured amounts in currency and keeps detector outputs distinct from observations", () => {
  expect(observedFeature("log_amount", Math.log1p(12345))).toBe("$123.45");
  expect(observedFeature("weekday", 0)).toBe("Monday");
  expect(observedFeature("amount_percentile", 0.75)).toBe(
    "75.0% of available history",
  );
  expect(observedFeature("v8_margin", 2)).toContain("Combined detector output");
  expect(observedFeature("merchant_frequency_soft", 0.25)).toBeNull();
});
const data = {
  eventId: event.eventId,
  modelBundleSha256: adaptation.bundle_sha256,
  method: "tree-shap-final-head-v1",
  baseValue: event.model!.score!.rawMargin - 2,
  rawMargin: event.model!.score!.rawMargin,
  probability: event.model!.score!.value,
  contributions: adaptation.features.map((feature, i) => ({
    feature,
    value: null,
    contribution: i ? 0 : 2,
  })),
};
it("accepts reconstructing attribution and labels every installed feature", () => {
  expect(decodeExplanation(data, event)).toEqual(data);
  for (const feature of adaptation.features)
    expect(featureLabels[feature]).toBeTruthy();
});
it("rejects mismatched payment, bundle, probability and contribution totals", () => {
  for (const changed of [
    { eventId: "wrong" },
    { modelBundleSha256: "0".repeat(64) },
    { probability: data.probability + 1 },
    { baseValue: data.baseValue + 1 },
    { contributions: data.contributions.slice(1) },
    { rawMargin: NaN },
  ])
    expect(() => decodeExplanation({ ...data, ...changed }, event)).toThrow();
});
