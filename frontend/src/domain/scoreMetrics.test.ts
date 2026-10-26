import { expect, it } from "vitest";
import {
  rankingMetrics,
  thresholdMetrics,
  probabilityMetrics,
} from "./scoreMetrics";

const row = (raw: number, label: boolean | null) => ({
  raw,
  label,
  distance: raw,
  value: 100 / (1 + Math.exp(-raw)),
});

it("evaluates probability loss and separates probability cutoffs from reference decisions", () => {
  const rows = [
    { ...row(-1, true), value: 80, probability: true },
    { ...row(1, false), value: 10, probability: true },
  ];
  const result = probabilityMetrics(rows)!;
  expect(result.brier).toBeCloseTo(0.025, 14);
  expect(result.logLoss).toBeCloseTo((-Math.log(0.8) - Math.log(0.9)) / 2, 14);
  expect(result.fraudRmse).toBeCloseTo(20, 12);
  expect(result.legitimateRmse).toBeCloseTo(10, 12);
  expect(result.bins).toEqual([
    { lower: 10, upper: 20, count: 1, mean: 10, observed: 0 },
    { lower: 80, upper: 90, count: 1, mean: 80, observed: 100 },
  ]);
  expect(thresholdMetrics(rows, 50)).toMatchObject({ tp: 1, fp: 0 });
  expect(thresholdMetrics(rows, 50, true)).toMatchObject({ tp: 0, fp: 1 });
  expect(probabilityMetrics([row(0, true)])).toBeNull();
  expect(
    probabilityMetrics([{ ...row(0, null), probability: true }]),
  ).toBeNull();
});

it("calculates tie-aware ranking metrics without rounding the score", () => {
  const rows = [
    row(3, true),
    row(2, false),
    row(2, true),
    row(1, false),
    row(4, null),
  ];
  expect(rankingMetrics(rows).ap).toBeCloseTo(5 / 6, 14);
  expect(rankingMetrics(rows)).toMatchObject({
    auc: 0.875,
    positives: 2,
    negatives: 2,
  });
  expect(rankingMetrics([row(0, true), row(0, false)])).toEqual({
    ap: 0.5,
    auc: 0.5,
    positives: 1,
    negatives: 1,
  });
  expect(rankingMetrics([row(-1000, true), row(-1001, false)]).auc).toBe(1);
  expect(rankingMetrics([row(2, true)]).ap).toBeNull();
  expect(rankingMetrics([row(2, null)]).auc).toBeNull();
});

it("uses exact margin boundaries and keeps unlabeled workload out of accuracy", () => {
  const rows = [
    row(0, true),
    row(-1e-16, false),
    row(1, null),
    row(-1, true),
    row(2, false),
  ];
  expect(rows[1]!.value).toBe(50); // Floating-point display rounding cannot create an alert.
  expect(thresholdMetrics(rows, 50)).toEqual({
    tp: 1,
    fp: 1,
    fn: 1,
    tn: 1,
    reviews: 3,
    precision: 0.5,
    recall: 0.5,
  });
  expect(thresholdMetrics(rows, 0).reviews).toBe(5);
  expect(thresholdMetrics(rows, 100).reviews).toBe(0);
  expect(thresholdMetrics([row(1, null)], 50).precision).toBeNull();
});
