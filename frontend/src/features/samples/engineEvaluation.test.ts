import { expect, it } from "vitest";
import evaluation from "./evaluation.json";
import manifest from "../../../../backend/model_artifacts/stack-d5/manifest.json";

it("keeps published evaluation counts consistent with the installed engine and review budget", () => {
  expect(evaluation.headSha256).toBe(manifest.models.stack_d5.sha256);
  expect(evaluation.expertCount).toBe(manifest.experts.length);
  expect(evaluation.historyFeatureCount).toBe(
    manifest.models.stack_d5.features.length - manifest.experts.length,
  );
  expect(evaluation.datasets).toHaveLength(5);
  for (const row of evaluation.datasets) {
    expect(row.assessed).toBe(row.rows);
    expect(row.reviews).toBe(
      Math.ceil(row.assessed * evaluation.reviewFraction),
    );
    expect(row.detections + row.false_alerts).toBe(row.reviews);
    expect(row.detections).toBeLessThanOrEqual(row.fraud);
    expect(row.averagePrecision).toBeGreaterThanOrEqual(0);
    expect(row.averagePrecision).toBeLessThanOrEqual(1);
  }
  expect(evaluation.datasets.reduce((sum, row) => sum + row.rows, 0)).toBe(
    484663,
  );
});
