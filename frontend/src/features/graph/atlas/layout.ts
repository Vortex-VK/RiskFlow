import type { Entity, Position } from "../../../domain/types";
import {
  sharedEntities,
  type TransactionGroup,
} from "../../../domain/hierarchy";
import { sectorLayoutKey, type Sector } from "./model";
import { envelope, packSectors } from "./packing";
import { arrangeLeaf } from "./leaf-layout";

export function insideTerritory(p: Position, polygon: Position[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function territoryPath(polygon: Position[]) {
  return polygon.length
    ? `M${polygon.map((p) => `${p.x},${p.y}`).join("L")}Z`
    : "";
}
export function buildAtlasMap(
  root: TransactionGroup,
  entities: Entity[],
  saved: ReadonlyMap<string, Record<string, Position>> = new Map(),
) {
  const result = new Map<string, Sector>();
  const stableEntities = [...entities].sort((a, b) => a.id.localeCompare(b.id));
  function build(group: TransactionGroup): Sector {
    const children = group.children.map(build);
    const shared: Sector["shared"] = [];
    for (let i = 0; i < children.length; i++)
      for (let j = i + 1; j < children.length; j++) {
        const common = sharedEntities(
          children[i]!.group,
          children[j]!.group,
          stableEntities,
        );
        if (common.length)
          shared.push({ source: i, target: j, entities: common });
      }
    const centers = packSectors(children, shared);
    const initialPositions = children.length
      ? {}
      : arrangeLeaf(group, entities);
    const placed = children.map((sector, i) => ({
      sector,
      scale: 1,
      center: centers[i]!,
    }));
    const territory = envelope(
      children.length
        ? placed.flatMap((c) =>
            c.sector.territory.map((p) => ({
              x: p.x + c.center.x,
              y: p.y + c.center.y,
            })),
          )
        : Object.values(initialPositions),
      children.length ? 25 : 55,
    );
    const sector: Sector = {
      group,
      shared,
      children: placed,
      territory,
      radius: Math.max(...territory.map((p) => Math.hypot(p.x, p.y))),
      positions: children.length
        ? {}
        : (saved.get(sectorLayoutKey(group)) ?? initialPositions),
    };
    result.set(group.id, sector);
    return sector;
  }
  const top = build(root);
  const xx = top.children.reduce(
    (sum, c) => sum + c.center.x * c.center.x * c.sector.group.payments.length,
    0,
  );
  const yy = top.children.reduce(
    (sum, c) => sum + c.center.y * c.center.y * c.sector.group.payments.length,
    0,
  );
  const xy = top.children.reduce(
    (sum, c) => sum + c.center.x * c.center.y * c.sector.group.payments.length,
    0,
  );
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  const rotate = (p: Position) => ({
    x: p.x * Math.cos(angle) + p.y * Math.sin(angle),
    y: -p.x * Math.sin(angle) + p.y * Math.cos(angle),
  });
  function orient(s: Sector): Sector {
    const next = {
      ...s,
      territory: s.territory.map(rotate),
      positions:
        saved.get(sectorLayoutKey(s.group)) ??
        Object.fromEntries(
          Object.entries(s.positions).map(([id, p]) => [id, rotate(p)]),
        ),
      children: s.children.map((c) => ({
        ...c,
        center: rotate(c.center),
        sector: orient(c.sector),
      })),
    };
    result.set(s.group.id, next);
    return next;
  }
  orient(top);
  return result;
}
