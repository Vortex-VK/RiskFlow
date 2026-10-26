import { describe, expect, it } from "vitest";
import source from "../../../../../fixtures/imports/transactions-synthetic.csv?raw";
import {
  buildCsvDocument,
  initialMapping,
  parseCsv,
} from "../../../domain/csv";
import { buildHierarchy } from "../../../domain/hierarchy";
import { buildAtlasMap, insideTerritory } from "./layout";
import { sectorOffset, sectorLayoutKey } from "./model";
import { sectorCloud } from "./point-cloud";
import {
  sectorConnections,
  visibleConnections,
  connectionPayments,
  previewConnections,
} from "./connections";

const table = parseCsv(source);
const scenario = buildCsvDocument(table, initialMapping(table.headers), {
  name: "Atlas",
  openedAt: "1900-01-01T00:00:00.000Z",
  typicalAmount: "50.00",
  countries: "US",
  categories: "retail",
  merchantCategory: "other",
  merchantCountry: "US",
  locationCountry: "US",
}).document!.scenario;
const root = buildHierarchy(scenario);
const atlas = buildAtlasMap(root, scenario.nodes);

describe("continuous transaction atlas", () => {
  it("places uncapped evidence sectors without overlapping their bounding circles", () => {
    const independentTable = parseCsv(
      [
        "payment_id,timestamp,amount,account_id,merchant_id,device_id,location_id",
        ...Array.from(
          { length: 60 },
          (_, i) => `P${i},2026-10-20T09:00:00Z,10,A${i},M${i},D${i},L${i}`,
        ),
      ].join("\n"),
    );
    const independent = buildCsvDocument(
      independentTable,
      initialMapping(independentTable.headers),
      {
        name: "Independent accounts",
        openedAt: "1900-01-01T00:00:00Z",
        typicalAmount: "50",
        countries: "US",
        categories: "retail",
        merchantCategory: "other",
        merchantCountry: "US",
        locationCountry: "US",
      },
    ).document!.scenario;
    const independentRoot = buildHierarchy(independent);
    const children = buildAtlasMap(independentRoot, independent.nodes).get(
      independentRoot.id,
    )!.children;
    expect(children.length).toBeGreaterThan(48);
    for (let i = 0; i < children.length; i++)
      for (let j = i + 1; j < children.length; j++) {
        const a = children[i]!,
          b = children[j]!;
        expect(
          Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y),
        ).toBeGreaterThan(a.sector.radius + b.sector.radius);
      }
  });
  it("matches every included CSV payment's ID, amount, time and endpoints without duplicating payments", () => {
    const rows = table.rows.map((row) =>
      Object.fromEntries(table.headers.map((h, i) => [h, row.cells[i]!])),
    );
    const eligible = rows.filter(
      (r) =>
        r.direction === "debit" &&
        ["purchase", "bill_payment"].includes(r.transaction_type!) &&
        !["refunded", "reversed", "cancelled", "canceled"].includes(r.status!),
    );
    expect(eligible).toHaveLength(3434);
    const csv = new Map(eligible.map((r) => [r.transaction_id, r]));
    const nodes = new Map(scenario.nodes.map((n) => [n.id, n]));
    for (const payment of scenario.payments) {
      const row = csv.get(payment.id)!;
      expect(row).toBeDefined();
      expect(payment.amountMinor).toBe(Math.round(Number(row.amount) * 100));
      expect(payment.occurredAt).toBe(new Date(row.timestamp!).toISOString());
      expect(nodes.get(payment.accountId)!.name).toBe(row.account_id);
      expect(nodes.get(payment.merchantId)!.name).toBe(row.merchant_name);
      if (row.device_id)
        expect(nodes.get(payment.deviceId)!.name).toBe(row.device_id);
    }
    const ids = [...atlas.values()]
      .filter((s) => !s.children.length)
      .flatMap((s) => s.group.payments.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...csv.keys()].sort());
  });
  it("connects only real shared identities, with verifiable rows and more links at deeper levels", () => {
    const top = atlas.get(root.id)!;
    const links = sectorConnections(top, scenario.nodes);
    expect(links.length).toBeGreaterThan(
      visibleConnections(links, 0, top.children.length).length,
    );
    const allPoints = sectorCloud(
      top,
      new Map(scenario.nodes.map((n) => [n.id, n])),
    ).points;
    for (const link of links) {
      for (const group of [link.a, link.b])
        expect(group.entityIds.has(link.witness)).toBe(true);
      for (const end of [link.start, link.end])
        expect(
          allPoints.some(
            (p) =>
              p.id === link.witness &&
              Math.hypot(p.x - end.x, p.y - end.y) < 0.001,
          ),
        ).toBe(true);
      for (const entity of link.entities)
        for (const { rows } of connectionPayments(link, entity.id)) {
          expect(rows.length).toBeGreaterThan(0);
          for (const p of rows)
            expect([p.accountId, p.merchantId, p.deviceId]).toContain(
              entity.id,
            );
        }
    }
    const visible = visibleConnections(links, 0, top.children.length);
    const deeper = visibleConnections(links, 1, top.children.length);
    expect(visible.length).toBeLessThan(links.length);
    expect(deeper.length).toBeGreaterThan(visible.length);
    expect(visible.every((l) => deeper.includes(l))).toBe(true);
  });
  it("previews one child level with exact shared-object endpoints and limits the final overview", () => {
    const top = atlas.get(root.id)!;
    const previews = previewConnections(top, scenario.nodes);
    expect(previews.length).toBeGreaterThan(0);
    const points = sectorCloud(
      top,
      new Map(scenario.nodes.map((n) => [n.id, n])),
    ).points;
    for (const link of previews) {
      expect(link.a.id.split("/").length).toBe(
        top.group.id.split("/").length + 2,
      );
      for (const endpoint of [link.start, link.end])
        expect(
          points.some(
            (p) =>
              p.id === link.witness &&
              Math.hypot(p.x - endpoint.x, p.y - endpoint.y) < 0.001,
          ),
        ).toBe(true);
    }
    const finalOverviews = [...atlas.values()].filter(
      (s) =>
        s.children.length > 2 &&
        s.children.every((c) => !c.sector.children.length),
    );
    expect(finalOverviews.length).toBeGreaterThan(0);
    for (const s of finalOverviews) {
      expect(previewConnections(s, scenario.nodes)).toEqual([]);
      expect(
        visibleConnections(
          sectorConnections(s, scenario.nodes),
          6,
          s.children.length,
        ).length,
      ).toBeLessThanOrEqual(s.children.length);
    }
  });
  it("generates a repeatable footprint from the relationships instead of a template", () => {
    const again = buildAtlasMap(root, scenario.nodes);
    expect(again.get(root.id)!.children.map((c) => c.center)).toEqual(
      atlas.get(root.id)!.children.map((c) => c.center),
    );
    const geometry = atlas.get(root.id)!;
    expect(geometry.territory!.length).toBeGreaterThan(9);
    expect(geometry.children.every((c) => c.scale === 1)).toBe(true);
  });
  it("preserves every real payment and keeps all initial points inside their exact territories", () => {
    const cloud = sectorCloud(
      atlas.get(root.id)!,
      new Map(scenario.nodes.map((n) => [n.id, n])),
    );
    expect(cloud.payments).toBe(scenario.payments.length);
    for (const point of cloud.points) {
      const leaf = atlas.get(point.leaf)!;
      expect(insideTerritory(leaf.positions[point.id]!, leaf.territory!)).toBe(
        true,
      );
      const offset = sectorOffset(atlas.get(root.id)!, point.leaf)!;
      expect(offset.scale).toBe(1);
      expect(point.x).toBeCloseTo(leaf.positions[point.id]!.x + offset.x, 6);
      expect(point.y).toBeCloseTo(leaf.positions[point.id]!.y + offset.y, 6);
    }
  });
  it("keeps final interactive objects separated", () => {
    for (const leaf of atlas.values()) {
      const points = Object.values(leaf.positions);
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++)
          expect(
            Math.hypot(
              points[i]!.x - points[j]!.x,
              points[i]!.y - points[j]!.y,
            ),
          ).toBeGreaterThan(88);
    }
  });
  it("retains edited leaf coordinates without repositioning neighboring sectors", () => {
    const leaf = [...atlas.values()].find((s) => !s.children.length)!;
    const id = Object.keys(leaf.positions)[0]!;
    const edited = { ...leaf.positions, [id]: { x: 3000, y: -2000 } };
    const rebuilt = buildAtlasMap(
      root,
      scenario.nodes,
      new Map([[sectorLayoutKey(leaf.group), edited]]),
    );
    expect(rebuilt.get(leaf.group.id)!.positions).toEqual(edited);
    expect(leaf.positions[id]).not.toEqual(edited[id]);
    for (const [key, sector] of atlas) {
      expect(rebuilt.get(key)!.children.map((c) => c.center)).toEqual(
        sector.children.map((c) => c.center),
      );
    }
  });
  it("preserves payment facts and geometry when entity input order changes", () => {
    const original = structuredClone(scenario);
    const reordered = buildAtlasMap(root, [...scenario.nodes].reverse());
    for (const [id, sector] of atlas) {
      const next = reordered.get(id)!;
      expect(Object.keys(next.positions).sort()).toEqual(
        Object.keys(sector.positions).sort(),
      );
      for (const [entityId, point] of Object.entries(sector.positions)) {
        expect(next.positions[entityId]!.x).toBeCloseTo(point.x, 7);
        expect(next.positions[entityId]!.y).toBeCloseTo(point.y, 7);
      }
      expect(next.children).toHaveLength(sector.children.length);
      sector.children.forEach((child, i) => {
        expect(next.children[i]!.center.x).toBeCloseTo(child.center.x, 7);
        expect(next.children[i]!.center.y).toBeCloseTo(child.center.y, 7);
      });
    }
    expect(scenario).toEqual(original);
    expect(atlas.get(root.id)!.group).toBe(root);
    expect(sectorOffset(atlas.get(root.id)!, "missing")).toBeNull();
  });
  it("rebuilds endpoint coordinates after editing a payment with a saved leaf layout", () => {
    const initial = { ...scenario, payments: [scenario.payments[0]!] };
    const before = buildHierarchy(initial);
    const initialMap = buildAtlasMap(before, initial.nodes);
    const saved = new Map([
      [sectorLayoutKey(before), initialMap.get(before.id)!.positions],
    ]);
    const replacement = initial.nodes.find(
      (n) => n.type === "device" && n.id !== initial.payments[0]!.deviceId,
    )!;
    const updated = {
      ...initial,
      payments: [{ ...initial.payments[0]!, deviceId: replacement.id }],
    };
    const after = buildHierarchy(updated);
    const rebuilt = buildAtlasMap(after, updated.nodes, saved);
    const points = sectorCloud(
      rebuilt.get(after.id)!,
      new Map(updated.nodes.map((n) => [n.id, n])),
    ).points;
    expect(points.map((p) => p.id).sort()).toEqual(
      [
        updated.payments[0]!.accountId,
        updated.payments[0]!.merchantId,
        replacement.id,
        updated.payments[0]!.locationId,
      ].sort(),
    );
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    expect(
      rebuilt.get(after.id)!.positions[initial.payments[0]!.deviceId],
    ).toBeUndefined();
    expect(updated.payments[0]!.id).toBe(initial.payments[0]!.id);
  });
});
