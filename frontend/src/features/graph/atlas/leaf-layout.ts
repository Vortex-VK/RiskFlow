import type { Entity } from "../../../domain/types";
import type { TransactionGroup } from "../../../domain/hierarchy";
export function arrangeCircles(
  radii: number[],
  links: { source: number; target: number; weight: number }[],
  gap: number,
) {
  const largest = Math.max(...radii, 1);
  const points = radii.map((_, i) => ({
    x: Math.cos(i * 2.399963) * Math.sqrt(i) * (largest * 2 + gap),
    y: Math.sin(i * 2.399963) * Math.sqrt(i) * (largest * 2 + gap),
  }));
  for (let step = 0; step < 160; step++) {
    if (step < 100) {
      for (const p of points) {
        p.x *= 1 - 0.025;
        p.y *= 1 - 0.025;
      }
      for (const link of links) {
        const a = points[link.source]!,
          b = points[link.target]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const pull =
          Math.max(
            0,
            distance - radii[link.source]! - radii[link.target]! - gap,
          ) *
          0.008 *
          Math.min(3, link.weight);
        const x = ((b.x - a.x) / distance) * pull,
          y = ((b.y - a.y) / distance) * pull;
        a.x += x;
        a.y += y;
        b.x -= x;
        b.y -= y;
      }
    }
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!,
          b = points[j]!;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          minimum = radii[i]! + radii[j]! + gap;
        if (dx * dx + dy * dy >= minimum * minimum) continue;
        const distance = Math.hypot(dx, dy) || 1;
        const overlap = minimum - distance;
        if (overlap > 0) {
          const x = (dx / distance) * overlap * 0.5,
            y = (dy / distance) * overlap * 0.5;
          a.x -= x;
          a.y -= y;
          b.x += x;
          b.y += y;
        }
      }
  }
  const cx = points.reduce((sum, p) => sum + p.x, 0) / (points.length || 1);
  const cy = points.reduce((sum, p) => sum + p.y, 0) / (points.length || 1);
  const centered = points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  return centered;
}

export function arrangeLeaf(group: TransactionGroup, entities: Entity[]) {
  const marks = entities
    .filter((n) => group.entityIds.has(n.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const indices = new Map(marks.map((n, i) => [n.id, i]));
  const adjacency = new Map<
    string,
    { source: number; target: number; weight: number }
  >();
  for (const payment of group.payments)
    for (const other of [
      payment.merchantId,
      payment.deviceId,
      payment.locationId,
    ]) {
      const key = JSON.stringify([payment.accountId, other]);
      if (!adjacency.has(key))
        adjacency.set(key, {
          source: indices.get(payment.accountId)!,
          target: indices.get(other)!,
          weight: 1,
        });
    }
  const points = arrangeCircles(
    marks.map(() => 48),
    [...adjacency.values()],
    56,
  );
  return Object.fromEntries(marks.map((n, i) => [n.id, points[i]!]));
}
