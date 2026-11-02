import type { Position } from "../../../domain/types";
import type { Sector } from "./model";
import { arrangeCircles } from "./leaf-layout";

function hull(points: Position[]): Position[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Position, b: Position, c: Position) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: Position[]) => {
    const out: Position[] = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
export function envelope(points: Position[], margin = 55) {
  return hull(
    hull(points).flatMap((p) =>
      Array.from({ length: 12 }, (_, i) => ({
        x: p.x + Math.cos((i * Math.PI) / 6) * margin,
        y: p.y + Math.sin((i * Math.PI) / 6) * margin,
      })),
    ),
  );
}
function axes(a: Position[], b: Position[]) {
  return [
    ...a.map((p, i) => [p, a[(i + 1) % a.length]!] as const),
    ...b.map((p, i) => [p, b[(i + 1) % b.length]!] as const),
  ].map(([p, q]) => {
    const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const x = -(q.y - p.y) / length,
      y = (q.x - p.x) / length;
    const aa = a.map((v) => v.x * x + v.y * y),
      bb = b.map((v) => v.x * x + v.y * y);
    return {
      x,
      y,
      amin: Math.min(...aa),
      amax: Math.max(...aa),
      bmin: Math.min(...bb),
      bmax: Math.max(...bb),
    };
  });
}
function separation(list: ReturnType<typeof axes>, a: Position, b: Position) {
  let best = { overlap: Infinity, x: 1, y: 0 };
  for (const axis of list) {
    const av = a.x * axis.x + a.y * axis.y,
      bv = b.x * axis.x + b.y * axis.y;
    const forward = axis.amax + av - axis.bmin - bv,
      backward = axis.bmax + bv - axis.amin - av;
    const overlap = Math.min(forward, backward),
      sign = forward < backward ? 1 : -1;
    if (overlap < best.overlap)
      best = { overlap, x: axis.x * sign, y: axis.y * sign };
  }
  return best;
}
export function packSectors(children: Sector[], shared: Sector["shared"]) {
  // Dense evidence maps keep every sector. Use bounding circles for placement
  // rather than allocating hull projection axes for every pair of sectors.
  if (children.length > 48) {
    const frequency = new Map<string, number>();
    for (const child of children)
      for (const id of child.group.entityIds)
        frequency.set(id, (frequency.get(id) || 0) + 1);
    const links = shared
      .map((link) => ({
        source: link.source,
        target: link.target,
        weight: link.entities.reduce(
          (sum, entity) =>
            sum +
            (entity.type === "device" ? 8 : entity.type === "account" ? 4 : 1) /
              frequency.get(entity.id)!,
          0,
        ),
      }))
      .sort(
        (a, b) =>
          b.weight - a.weight || a.source - b.source || a.target - b.target,
      );
    return arrangeCircles(
      children.map((child) => child.radius),
      links.slice(0, children.length * 3),
      65,
    );
  }
  const sizes = children.map((c) =>
    Math.sqrt(
      Math.max(
        1,
        Math.abs(
          c.territory.reduce((sum, p, i) => {
            const q = c.territory[(i + 1) % c.territory.length]!;
            return sum + p.x * q.y - q.x * p.y;
          }, 0),
        ) / 2,
      ),
    ),
  );
  const typical = sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length);
  const points = children.map((_, i) => ({
    x: Math.cos(i * 2.399963) * Math.sqrt(i) * typical,
    y: Math.sin(i * 2.399963) * Math.sqrt(i) * typical,
  }));
  const pairs: { i: number; j: number; axes: ReturnType<typeof axes> }[] = [];
  for (let i = 0; i < children.length; i++)
    for (let j = i + 1; j < children.length; j++)
      pairs.push({
        i,
        j,
        axes: axes(children[i]!.territory, children[j]!.territory),
      });
  const frequency = new Map<string, number>();
  for (const c of children)
    for (const id of c.group.entityIds)
      frequency.set(id, (frequency.get(id) || 0) + 1);
  const links = shared.map((s) => ({
    ...s,
    weight: s.entities.reduce(
      (sum, e) =>
        sum +
        (e.type === "device" ? 8 : e.type === "account" ? 4 : 1) /
          (frequency.get(e.id) || 1),
      0,
    ),
  }));
  for (let step = 0; step < 240; step++) {
    if (step < 180) {
      points.forEach((p) => {
        p.x *= 0.994;
        p.y *= 0.994;
      });
      for (const l of links) {
        const a = points[l.source]!,
          b = points[l.target]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          dist = Math.hypot(dx, dy) || 1;
        const ideal = (sizes[l.source]! + sizes[l.target]!) * 0.45 + 65;
        const pull =
          Math.max(0, dist - ideal) *
          0.012 *
          Math.min(4, Math.log2(1 + l.weight));
        a.x += (dx / dist) * pull;
        a.y += (dy / dist) * pull;
        b.x -= (dx / dist) * pull;
        b.y -= (dy / dist) * pull;
      }
    }
    for (const pair of pairs) {
      const a = points[pair.i]!,
        b = points[pair.j]!,
        s = separation(pair.axes, a, b);
      if (s.overlap > -65) {
        const push = (s.overlap + 65) * 0.505;
        a.x -= s.x * push;
        a.y -= s.y * push;
        b.x += s.x * push;
        b.y += s.y * push;
      }
    }
  }
  const center = {
    x: points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length),
    y: points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.length),
  };
  return points.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
}
