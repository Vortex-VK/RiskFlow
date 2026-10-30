import { describe, expect, it } from "vitest";
import {
  growthTree,
  recentTransactionGlows,
  firingOpacity,
  riskOpacity,
  TRANSACTION_GLOW_DURATION,
  GROWTH_WAVE_DURATION,
  GROWTH_DURATION,
} from "./growth";

describe("graph entrance", () => {
  it("sweeps initial seeds left to right before the existing branch growth", () => {
    const left = { x: 0, y: 0 },
      right = { x: 100, y: 0 };
    const child = { x: 10, y: 10 };
    const branches = growthTree([right, child, left], [[left, child]]);
    const time = (point: typeof left) =>
      branches.find((branch) => branch.point === point)!.time;
    expect(time(left)).toBe(0);
    expect(time(right)).toBe(1000);
    expect(time(child)).toBeGreaterThanOrEqual(GROWTH_WAVE_DURATION);
    expect(time(child) + 850).toBeLessThan(GROWTH_DURATION);
    expect(growthTree([], [])).toEqual([]);
  });

  it("uses only actual links and never joins disconnected components", () => {
    const a = { x: 0, y: 0 },
      b = { x: 2, y: 0 },
      c = { x: 1, y: 0 },
      isolated = { x: 1.1, y: 0 };
    const links = [
      [a, b],
      [b, c],
      [c, a],
    ] as const;
    const branches = growthTree([a, b, c, isolated], links);
    expect(branches).toHaveLength(4);
    expect(new Set(branches.map((branch) => branch.point))).toEqual(
      new Set([a, b, c, isolated]),
    );
    const connected = branches.filter(
      (branch) => branch.parent !== branch.point,
    );
    expect(connected).toHaveLength(2);
    for (const branch of connected) {
      expect(
        links.some(
          ([x, y]) =>
            (x === branch.parent && y === branch.point) ||
            (y === branch.parent && x === branch.point),
        ),
      ).toBe(true);
    }
    expect(branches.find((b) => b.point === isolated)?.parent).toBe(isolated);
  });
});

describe("transaction afterglow", () => {
  it("overlaps real recent transactions, decays slowly, and clears on rewind", () => {
    const schedule = [{ start: 400 }, { start: 1050 }, { start: 1700 }];
    expect(recentTransactionGlows(schedule, 1500).map((p) => p.index)).toEqual([
      1, 0,
    ]);
    expect(
      firingOpacity(recentTransactionGlows(schedule, 1500)[1]!.progress),
    ).toBeGreaterThan(0.04);
    expect(recentTransactionGlows(schedule, 0)).toEqual([]);
    expect(recentTransactionGlows(schedule, 4200)).toEqual([]);
  });

  it("crossfades red along the original blue decay without a gap or second entrance", () => {
    const schedule = [{ start: 400 }];
    const at = (age: number) =>
      recentTransactionGlows(schedule, 400 + age)[0]?.progress;
    expect(riskOpacity(at(40))).toBe(0);
    for (const age of [84, 200, 400, 800, 1600, 2399]) {
      const progress = at(age)!;
      const blue = firingOpacity(progress);
      const red = riskOpacity(progress);
      expect(blue).toBeGreaterThan(0);
      expect(blue + red).toBeCloseTo(1);
      if (age > 84) expect(red).toBeGreaterThan(0);
    }
    expect(firingOpacity(1)).toBe(0);
    expect(at(TRANSACTION_GLOW_DURATION)).toBeUndefined();
    expect(riskOpacity(at(TRANSACTION_GLOW_DURATION))).toBe(1);
  });
});
