import type { Entity, Position } from "../../../domain/types";
import { type TransactionGroup } from "../../../domain/hierarchy";

export type Sector = {
  territory: Position[];
  group: TransactionGroup;
  radius: number;
  children: { sector: Sector; center: Position; scale: number }[];
  positions: Record<string, Position>;
  shared: { source: number; target: number; entities: Entity[] }[];
};

export function sectorLayoutKey(group: TransactionGroup): string {
  return JSON.stringify([
    group.payments.map((p) => p.id),
    [...group.entityIds].sort(),
  ]);
}

export function sectorOffset(
  root: Sector,
  id: string,
): (Position & { scale: number }) | null {
  if (root.group.id === id) return { x: 0, y: 0, scale: 1 };
  for (const child of root.children) {
    const offset = sectorOffset(child.sector, id);
    if (offset)
      return {
        x: child.center.x + offset.x * child.scale,
        y: child.center.y + offset.y * child.scale,
        scale: child.scale * offset.scale,
      };
  }
  return null;
}
