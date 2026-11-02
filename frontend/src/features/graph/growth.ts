import type { Position } from "../../domain/types";

export const GROWTH_WAVE_DURATION = 1700;
export const GROWTH_DURATION = GROWTH_WAVE_DURATION + 5200;
export const DETAIL_GROWTH_DURATION = 1500;
export const DETAIL_NODE_FADE = 350;
export const DETAIL_GROWTH_SPREAD = 600;
// Traverse real relationships. Disconnected components grow independently;
// the entrance order is visual staging, not the graph construction algorithm.
export function growthTree<T extends Position>(
  points: readonly T[],
  links: readonly (readonly [T, T])[],
) {
  const neighbours = new Map(points.map((p) => [p, new Set<T>()]));
  for (const [a, b] of links) {
    neighbours.get(a)?.add(b);
    neighbours.get(b)?.add(a);
  }
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const seen = new Set<T>();
  const branches: { point: T; parent: T; time: number }[] = [];
  let longest = 1;
  for (const root of ordered) {
    if (seen.has(root)) continue;
    seen.add(root);
    const queue = [{ point: root, parent: root, time: 0 }];
    for (let i = 0; i < queue.length; i++) {
      const branch = queue[i]!;
      branches.push(branch);
      longest = Math.max(longest, branch.time);
      for (const point of neighbours.get(branch.point) || []) {
        if (seen.has(point)) continue;
        seen.add(point);
        queue.push({ point, parent: branch.point, time: branch.time + 1 });
      }
    }
  }
  // Sweep the initial seeds left to right before growing their real branches.
  const seeds = branches.filter((branch) => branch.point === branch.parent);
  const left = Math.min(...seeds.map((branch) => branch.point.x));
  const right = Math.max(...seeds.map((branch) => branch.point.x));
  return branches.map((branch) => ({
    ...branch,
    time:
      branch.point === branch.parent
        ? ((branch.point.x - left) / (right - left || 1)) * 1000
        : GROWTH_WAVE_DURATION + (branch.time / longest) * 4000,
  }));
}

// Fast ignition, then a long, smooth decay driven by the replay clock.
export function firingOpacity(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  return p < 0.035 ? p / 0.035 : Math.exp(-5 * (p - 0.035)) * (1 - p);
}

export const TRANSACTION_GLOW_DURATION = 2400;
// Red takes over as the original blue pulse decays, without an empty interval
// or a second entrance. The blue pulse keeps its original timing and curve.
export function riskOpacity(progress: number | undefined) {
  if (progress === undefined) return 1;
  return progress < 0.035 ? 0 : 1 - firingOpacity(progress);
}

export function recentTransactionGlows(
  schedule: readonly { start: number }[],
  elapsed: number,
) {
  // Binary search keeps this independent of the total imported event count.
  let low = 0,
    high = schedule.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (schedule[mid]!.start <= elapsed) low = mid + 1;
    else high = mid;
  }
  const result: { index: number; progress: number }[] = [];
  // Renderers merge repeated paths, retaining the brightest real event.
  for (let i = low - 1; i >= 0; i--) {
    const progress = (elapsed - schedule[i]!.start) / TRANSACTION_GLOW_DURATION;
    if (progress >= 1) break;
    result.push({ index: i, progress });
  }
  return result;
}
