import type { Entity } from "../../../domain/types";
import type { Sector } from "./model";

export function sectorColour(hue: number, dark: boolean) {
  return `hsl(${hue} ${dark ? 52 : 48}% ${dark ? 68 : 43}%)`;
}

export function sectorHue(id: string) {
  return (
    (210 +
      id
        .split("/")
        .slice(1)
        .map(Number)
        .reduce((sum, part, i) => sum + part * (i ? 43 : 137.508), 0)) %
    360
  );
}

export function sectorCloud(sector: Sector, entities: Map<string, Entity>) {
  const points: {
    x: number;
    y: number;
    type: Entity["type"];
    id: string;
    leaf: string;
  }[] = [];
  const links: [(typeof points)[number], (typeof points)[number]][] = [];
  let payments = 0;
  function visit(current: Sector, x: number, y: number, scale: number) {
    if (current.children.length) {
      for (const child of current.children)
        visit(
          child.sector,
          x + child.center.x * scale,
          y + child.center.y * scale,
          scale * child.scale,
        );
      return;
    }
    payments += current.group.payments.length;
    const local = new Map<string, (typeof points)[number]>();
    for (const [id, point] of Object.entries(current.positions)) {
      const entity = entities.get(id)!;
      const plotted = {
        id,
        leaf: current.group.id,
        type: entity.type,
        x: x + point.x * scale,
        y: y + point.y * scale,
      };
      points.push(plotted);
      local.set(id, plotted);
    }
    const unique = new Set<string>();
    for (const payment of current.group.payments) {
      for (const target of [
        payment.merchantId,
        payment.deviceId,
        payment.locationId,
      ]) {
        const a = local.get(payment.accountId),
          b = local.get(target);
        const key = `${payment.accountId}:${target}`;
        if (a && b && !unique.has(key)) {
          links.push([a, b]);
          unique.add(key);
        }
      }
    }
  }
  visit(sector, 0, 0, 1);
  return { points, payments, links };
}
