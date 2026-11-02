import { describe, expect, it } from "vitest";
import source from "../../../fixtures/imports/transactions-synthetic.csv?raw";
import largeStatement from "../../../fixtures/imports/riskflow_transactions_l_9000.csv?raw";
import smallStatement from "../../../fixtures/imports/riskflow_transactions_s3_285.csv?raw";
import hero from "../../../fixtures/scenarios/shared-device-cluster.json";
import { decodeDocument } from "../api/decode";
import { buildCsvDocument, initialMapping, parseCsv } from "./csv";
import {
  buildHierarchy,
  pathToPayment,
  sharedEntities,
  type TransactionGroup,
} from "./hierarchy";

function importedSample(csv = source) {
  const table = parseCsv(csv);
  return buildCsvDocument(table, initialMapping(table.headers), {
    name: "Synthetic transaction history",
    openedAt: "1900-01-01T00:00:00.000Z",
    typicalAmount: "50.00",
    countries: "US",
    categories: "retail",
    merchantCategory: "other",
    merchantCountry: "US",
    locationCountry: "US",
  });
}

function checkTree(group: TransactionGroup, depth = 0): string[] {
  expect(depth).toBeLessThan(30);
  if (!group.children.length) {
    if (group.payments.length > 30)
      for (const key of [
        "accountId",
        "merchantId",
        "deviceId",
        "locationId",
        "category",
      ] as const)
        expect(new Set(group.payments.map((p) => p[key])).size).toBe(1);
    return group.payments.map((p) => p.id);
  }
  expect(group.children.length).toBeGreaterThanOrEqual(depth === 0 ? 1 : 2);
  const ids = group.children.flatMap((g) => checkTree(g, depth + 1));
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual(group.payments.map((p) => p.id).sort());
  return ids;
}

describe("transaction hierarchy", () => {
  it.each([
    ["large", largeStatement, 7612],
    ["small", smallStatement, 232],
  ] as const)(
    "preserves every payment in the %s statement without display subdivisions",
    (_name, csv, count) => {
      const result = importedSample(csv);
      expect(result.errors).toEqual([]);
      const scenario = result.document!.scenario;
      const tree = buildHierarchy(scenario);
      expect(checkTree(tree)).toHaveLength(count);
      expect(
        descendants(tree).every((g) => !g.reason.includes("Navigation group")),
      ).toBe(true);
      expect(tree.children.length).toBeGreaterThan(1);
      for (const community of tree.children)
        expect(
          new Set(community.payments.map((p) => p.accountId)).size,
        ).toBeGreaterThan(1);
      expect(
        buildHierarchy({
          ...scenario,
          nodes: [...scenario.nodes].reverse(),
          payments: [...scenario.payments].reverse(),
        }),
      ).toEqual(tree);
      for (const group of tree.children) {
        const id = group.payments[0]!.id;
        let current = tree;
        for (const next of pathToPayment(tree, id))
          current = current.children.find((c) => c.id === next)!;
        expect(current.children).toHaveLength(0);
        expect(current.payments.some((p) => p.id === id)).toBe(true);
      }
    },
  );

  function accountSample(
    count: number,
    device: (i: number, row: number) => string,
    commonMerchant = false,
  ) {
    return importedSample(
      [
        "payment_id,timestamp,amount,account_id,merchant_id,device_id,location_id",
        ...Array.from({ length: count * 31 }, (_, index) => {
          const i = Math.floor(index / 31);
          return `P${index},2026-10-20T09:00:00Z,10,A${i},${commonMerchant && index % 2 ? "popular" : `M${i}`},${device(i, index)},L${i}`;
        }),
      ].join("\n"),
    ).document!.scenario;
  }

  function descendants(group: TransactionGroup): TransactionGroup[] {
    return [group, ...group.children.flatMap(descendants)];
  }

  it("does not turn weak popular-merchant overlap into a community at deeper zoom levels", () => {
    const scenario = accountSample(40, (i) => `D${i}`, true);
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    expect(tree.children).toHaveLength(40);
    for (const group of descendants(tree).slice(1))
      expect(new Set(group.payments.map((p) => p.accountId)).size).toBe(1);
  });

  it("shows all independent shared-device communities without merging them to fit the screen", () => {
    const scenario = accountSample(80, (i) => `D${Math.floor(i / 2)}`);
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    expect(tree.children).toHaveLength(40);
    const groups = descendants(tree);
    const names = new Map(scenario.nodes.map((n) => [n.id, n.name]));
    for (let i = 0; i < 80; i += 2) {
      // Compare source account names; import IDs depend on shared device reuse.
      const pair = groups.find((g) => {
        const accounts = new Set(g.payments.map((p) => names.get(p.accountId)));
        return (
          accounts.size === 2 &&
          accounts.has(`A${i}`) &&
          accounts.has(`A${i + 1}`)
        );
      });
      expect(pair?.payments).toHaveLength(62);
    }
  });

  it("preserves an oversized community and flattens equal-strength merge ties into actual accounts", () => {
    const scenario = accountSample(24, () => "shared");
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]!.payments).toHaveLength(24 * 31);
    expect(tree.children[0]!.children).toHaveLength(24);
    expect(
      tree.children[0]!.children.every(
        (g) => new Set(g.payments.map((p) => p.accountId)).size === 1,
      ),
    ).toBe(true);
    for (const account of scenario.nodes.filter((n) => n.type === "account")) {
      expect(
        tree.children.filter((g) =>
          g.payments.some((p) => p.accountId === account.id),
        ),
      ).toHaveLength(1);
    }
  });

  it("finds stronger device communities despite a shared background device", () => {
    const scenario = accountSample(8, (i, row) =>
      row % 2 ? "shared" : `pair${Math.floor(i / 2)}`,
    );
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    const subgroups = tree.children;
    expect(subgroups).toHaveLength(4);
    expect(
      subgroups.every(
        (g) => new Set(g.payments.map((p) => p.accountId)).size === 2,
      ),
    ).toBe(true);
    expect(
      subgroups.every((g) => g.reason.includes("graph-wide baseline")),
    ).toBe(true);
  });

  it("does not change community membership just to rebalance payment volume", () => {
    const scenario = accountSample(8, (i) => `pair${Math.floor(i / 2)}`);
    const members = (tree: TransactionGroup) =>
      tree.children.map((g) =>
        [...new Set(g.payments.map((p) => p.accountId))].sort(),
      );
    const before = buildHierarchy(scenario);
    scenario.payments.push(
      ...Array.from({ length: 1000 }, (_, i) => ({
        ...scenario.payments[0]!,
        id: `extra${i}`,
      })),
    );
    const after = buildHierarchy(scenario);
    expect(members(after)).toEqual(members(before));
    expect(
      Math.max(...after.children.map((g) => g.payments.length)),
    ).toBeGreaterThan(scenario.payments.length * 0.8);
    checkTree(after);
  });

  it("uses actual calendar dates instead of equal-sized chronological batches", () => {
    const scenario = accountSample(1, () => "D");
    scenario.payments = Array.from({ length: 100 }, (_, i) => ({
      ...scenario.payments[0]!,
      id: `time${i}`,
      occurredAt:
        i < 90 ? "2026-10-20T09:00:00.000Z" : "2026-10-21T09:00:00.000Z",
    }));
    const tree = buildHierarchy(scenario);
    expect(tree.children.map((g) => [g.label, g.payments.length])).toEqual([
      ["2026-10-20", 90],
      ["2026-10-21", 10],
    ]);
    expect(tree.children[0]!.children).toHaveLength(0);
    checkTree(tree);
  });

  it("groups by individual payment categories when merchants have mixed categories", () => {
    const table = parseCsv(
      [
        "payment_id,timestamp,amount,account_id,merchant_id,merchant_category,device_id,location_id",
        ...Array.from(
          { length: 56 },
          (_, i) =>
            `P${i},2026-10-20T09:00:00Z,10,A,M${Math.floor(i / 4)},${i % 2 ? "retail" : "groceries"},D,L`,
        ),
      ].join("\n"),
    );
    const result = buildCsvDocument(table, initialMapping(table.headers), {
      name: "Mixed categories",
      openedAt: "1900-01-01T00:00:00Z",
      typicalAmount: "50",
      countries: "US",
      categories: "retail",
      merchantCategory: "other",
      merchantCountry: "US",
      locationCountry: "US",
    });
    expect(result.errors).toEqual([]);
    const scenario = result.document!.scenario;
    expect(
      scenario.nodes
        .filter((n) => n.type === "merchant")
        .every((n) => n.category === "other"),
    ).toBe(true);
    const tree = buildHierarchy(scenario);
    expect(new Set(tree.children.map((g) => g.label))).toEqual(
      new Set(["groceries", "retail"]),
    );
    for (const group of tree.children) {
      expect(group.payments).toHaveLength(28);
      expect(group.payments.every((p) => p.category === group.label)).toBe(
        true,
      );
    }
    checkTree(tree);
  });
  it("imports the supplied mixed statement, preserves every eligible payment exactly once, and groups deterministically", () => {
    const result = importedSample();
    expect(result.errors).toEqual([]);
    const scenario = result.document!.scenario;
    expect(scenario.payments).toHaveLength(3434);
    expect(scenario.nodes.length).toBeLessThanOrEqual(500);
    expect(result.warnings.join(" ")).toContain("436 rows excluded");
    expect(result.warnings.join(" ")).toContain("attempts");
    expect(scenario.groundTruth).toEqual({});
    const original = structuredClone(scenario);
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    expect(scenario).toEqual(original);
    const reversed = buildHierarchy({
      ...scenario,
      nodes: [...scenario.nodes].reverse(),
      payments: [...scenario.payments].reverse(),
    });
    expect(reversed).toEqual(tree);
    expect(
      new Set(tree.children.map((g) => g.payments.length)).size,
    ).toBeGreaterThan(1);
    const id = scenario.payments[1500]!.id;
    const path = pathToPayment(tree, id);
    let current = tree;
    for (const next of path)
      current = current.children.find((c) => c.id === next)!;
    expect(current.children).toHaveLength(0);
    expect(current.payments.some((p) => p.id === id)).toBe(true);
    for (const shared of sharedEntities(
      tree.children[0]!,
      tree.children[1]!,
      scenario.nodes,
    )) {
      expect(tree.children[0]!.entityIds.has(shared.id)).toBe(true);
      expect(tree.children[1]!.entityIds.has(shared.id)).toBe(true);
    }
  });

  it("keeps genuine shared-device communities together despite very uneven payment counts", () => {
    const scenario = decodeDocument(structuredClone(hero)).scenario;
    const base = scenario.payments[0]!;
    scenario.payments = Array.from({ length: 240 }, (_, i) => ({
      ...base,
      id: `P${i}`,
      accountId: i < 180 ? "a" : i < 200 ? "b" : i < 220 ? "c" : "d",
      deviceId: i < 200 ? "ab" : "cd",
      merchantId:
        i < 180 ? "shop-a" : i < 200 ? "shop-b" : i < 220 ? "shop-c" : "shop-d",
    }));
    const account = scenario.nodes.find((n) => n.type === "account")!;
    const merchant = scenario.nodes.find((n) => n.type === "merchant")!;
    const device = scenario.nodes.find((n) => n.type === "device")!;
    const location = scenario.nodes.find((n) => n.id === base.locationId)!;
    scenario.nodes = [
      ...["a", "b", "c", "d"].map((id) => ({ ...account, id })),
      ...["shop-a", "shop-b", "shop-c", "shop-d"].map((id) => ({
        ...merchant,
        id,
      })),
      ...["ab", "cd"].map((id) => ({ ...device, id })),
      location,
    ];
    const tree = buildHierarchy(scenario);
    expect(
      tree.children.map((g) => [
        ...new Set(g.payments.map((p) => p.accountId)),
      ]),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(tree.children.map((g) => g.payments.length)).toEqual([200, 40]);
    const community = tree.children[0]!;
    expect(
      sharedEntities(
        community.children[0]!,
        community.children[1]!,
        scenario.nodes,
      ).map((n) => n.id),
    ).toEqual(["ab"]);
    checkTree(tree);
    const unavailable = buildHierarchy({
      ...scenario,
      payments: scenario.payments.map((p) => ({
        ...p,
        unavailableRules: ["shared_device_accounts"],
      })),
    });
    expect(
      unavailable.children.map((g) => [
        ...new Set(g.payments.map((p) => p.accountId)),
      ]),
    ).toEqual([["a"], ["b"], ["c"], ["d"]]);
    expect(
      sharedEntities(
        unavailable.children[0]!,
        unavailable.children[1]!,
        scenario.nodes,
      ),
    ).toEqual([]);
  });

  it("keeps 10,000 indistinguishable payments together without inventing ID batches", () => {
    const scenario = decodeDocument(structuredClone(hero)).scenario;
    scenario.payments = Array.from({ length: 10000 }, (_, i) => ({
      ...scenario.payments[0]!,
      id: `P${String(i).padStart(5, "0")}`,
    }));
    const tree = buildHierarchy(scenario);
    checkTree(tree);
    expect(tree.children).toHaveLength(0);
    expect(tree.payments).toHaveLength(10000);
  });
});
