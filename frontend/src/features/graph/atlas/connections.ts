import type { Entity, Position } from "../../../domain/types";
import { paymentEntities } from "../../../domain/hierarchy";
import type { Sector } from "./model";
import { sectorCloud } from "./point-cloud";

export function sectorConnections(sector: Sector, entities: Entity[]) {
  const entityMap = new Map(entities.map((n) => [n.id, n]));
  const clouds = sector.children.map((c) => sectorCloud(c.sector, entityMap));
  const frequency = new Map<string, number>();
  for (const c of sector.children)
    for (const id of c.sector.group.entityIds)
      frequency.set(id, (frequency.get(id) || 0) + 1);
  return sector.shared
    .map((link) => {
      const a = sector.children[link.source]!,
        b = sector.children[link.target]!;
      const importance = (e: Entity) =>
        (e.type === "device" ? 8 : e.type === "account" ? 4 : 1) /
        (frequency.get(e.id) || 1);
      const shared = [...link.entities].sort(
        (a, b) => importance(b) - importance(a) || a.id.localeCompare(b.id),
      );
      const witness = shared[0]!;
      const aa = clouds[link.source]!.points.filter((p) => p.id === witness.id),
        bb = clouds[link.target]!.points.filter((p) => p.id === witness.id);
      const closest = (
        points: typeof aa,
        center: Position,
        target: Position,
      ) => {
        let best = { x: 0, y: 0 },
          distance = Infinity;
        for (const p of points) {
          const q = { x: p.x + center.x, y: p.y + center.y },
            d = Math.hypot(q.x - target.x, q.y - target.y);
          if (d < distance) {
            distance = d;
            best = q;
          }
        }
        return best;
      };
      const start = closest(aa, a.center, b.center),
        end = closest(bb, b.center, start);
      return {
        id: `${a.sector.group.id}:${b.sector.group.id}`,
        a: a.sector.group,
        b: b.sector.group,
        entities: shared,
        witness: witness.id,
        start,
        end,
        strength:
          shared.reduce((sum, e) => sum + importance(e), 0) /
          Math.sqrt(
            Math.max(
              1,
              a.sector.group.entityIds.size * b.sector.group.entityIds.size,
            ),
          ),
      };
    })
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}
export type SectorConnection = ReturnType<typeof sectorConnections>[number];
export function visibleConnections(
  links: SectorConnection[],
  depth: number,
  groups: number,
) {
  const nearDetail = links.every(
    (l) => !l.a.children.length && !l.b.children.length,
  );
  const budget = Math.min(
    links.length,
    Math.max(
      nearDetail ? 0 : 4,
      Math.ceil(
        groups * (nearDetail ? 1 : depth === 0 ? 1.2 : depth === 1 ? 2 : 3),
      ),
    ),
  );
  const selected = new Set<string>(),
    covered = new Set<string>();
  for (const link of links)
    if (
      selected.size < budget &&
      (!covered.has(link.a.id) || !covered.has(link.b.id))
    ) {
      selected.add(link.id);
      covered.add(link.a.id);
      covered.add(link.b.id);
    }
  for (const link of links) {
    if (selected.size >= budget) break;
    selected.add(link.id);
  }
  return links.filter((l) => selected.has(l.id));
}
export function connectionPayments(link: SectorConnection, entityId: string) {
  return [link.a, link.b].map((g) => ({
    group: g,
    rows: g.payments.filter((p) => paymentEntities(p).includes(entityId)),
  }));
}
export function previewConnections(sector: Sector, entities: Entity[]) {
  return sector.children.flatMap((child) => {
    if (!child.sector.children.length) return [];
    const links = visibleConnections(
      sectorConnections(child.sector, entities),
      0,
      child.sector.children.length,
    );
    const translate = (p: Position) => ({
      x: child.center.x + p.x * child.scale,
      y: child.center.y + p.y * child.scale,
    });
    return links.map((link) => ({
      ...link,
      start: translate(link.start),
      end: translate(link.end),
    }));
  });
}
