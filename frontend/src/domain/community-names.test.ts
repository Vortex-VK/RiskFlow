import { describe, expect, it } from "vitest";
import hero from "../../../fixtures/scenarios/shared-device-cluster.json";
import { decodeDocument } from "../api/decode";
import { communityEvidence } from "./community-evidence";
import { nameCommunities } from "./community-names";
import { buildHierarchy, groupLabel } from "./hierarchy";
import type { Entity, Payment } from "./types";
import smallStatement from "../../../fixtures/imports/riskflow_transactions_s3_285.csv?raw";
import { parseCsv, initialMapping, buildCsvDocument } from "./csv";

const original = decodeDocument(hero).scenario;
function payment(
  account: string,
  merchant: string,
  device: string,
  category: NonNullable<Payment["category"]> = "groceries",
): Payment {
  return {
    ...original.payments[0]!,
    accountId: account,
    merchantId: merchant,
    deviceId: device,
    category,
  };
}
function sample(rows: Payment[]) {
  const entities = new Map<string, Entity>();
  for (const p of rows)
    for (const [id, type] of [
      [p.accountId, "account"],
      [p.merchantId, "merchant"],
      [p.deviceId, "device"],
      [p.locationId, "location"],
    ] as const)
      entities.set(id, {
        ...original.nodes.find((n) => n.type === type)!,
        id,
        name: id,
      } as Entity);
  const payments = rows.map((p, i) => ({ ...p, id: `payment-${i}` }));
  return {
    entities,
    evidence: communityEvidence(payments, entities),
    scenario: {
      ...original,
      payments,
      nodes: [...entities.values()],
      associations: [],
    },
  };
}
const background = [
  payment("c", "mc", "D99", "travel"),
  payment("d", "md", "D99", "travel"),
];

function nameCommunity(
  ids: string[],
  evidence: ReturnType<typeof communityEvidence>,
  entities: Map<string, Entity>,
) {
  const others = evidence.profiles
    .map((p) => p.id)
    .filter((id) => !ids.includes(id));
  return nameCommunities(
    others.length ? [ids, others] : [ids],
    evidence,
    entities,
  )[0]!;
}

describe("sector-wide connection names", () => {
  it("explains the supplied account sectors without changing their membership", () => {
    const table = parseCsv(smallStatement);
    const scenario = buildCsvDocument(table, initialMapping(table.headers), {
      name: "Sample",
      openedAt: "1900-01-01T00:00:00Z",
      typicalAmount: "50",
      countries: "US",
      categories: "retail",
      merchantCategory: "other",
      merchantCountry: "US",
      locationCountry: "US",
    }).document!.scenario;
    const root = buildHierarchy(scenario);
    const names = new Map(scenario.nodes.map((n) => [n.id, n.name]));
    const memberships = (tree: ReturnType<typeof buildHierarchy>) =>
      tree.children.map((g) =>
        [...new Set(g.payments.map((p) => names.get(p.accountId)))].sort(),
      );
    expect(memberships(root)).toEqual([
      [
        "ACC-S3-0001",
        "ACC-S3-0002",
        "ACC-S3-0003",
        "ACC-S3-0004",
        "ACC-S3-0009",
        "ACC-S3-0010",
      ],
      [
        "ACC-S3-0005",
        "ACC-S3-0006",
        "ACC-S3-0007",
        "ACC-S3-0008",
        "ACC-S3-0011",
      ],
    ]);
    expect(root.children.map((g) => g.label)).toEqual([
      "Retail-linked accounts",
      "Utility-linked accounts",
    ]);
    expect(root.children[0]!.reason).toContain(
      "5 of 6 accounts; 30% of distinguishing connection evidence here versus 7%",
    );
    expect(root.children[1]!.reason).toContain(
      "4 of 5 accounts; 28% of distinguishing connection evidence here versus 12%",
    );
    expect(root.children.map((g) => g.payments.length)).toEqual([135, 97]);
    // Changing descriptive metadata must never change the community algorithm.
    const changed = buildHierarchy({
      ...scenario,
      payments: scenario.payments.map((p) => ({
        ...p,
        sourceCategory: "different",
      })),
    });
    expect(memberships(changed)).toEqual(memberships(root));
  });

  it("does not use universally shared devices as a fallback for merchant differences", () => {
    const { evidence, entities } = sample([
      payment("a", "Target", "common", "retail"),
      payment("b", "Target", "common", "retail"),
      payment("x", "Best Buy", "common", "retail"),
      payment("y", "Best Buy", "common", "retail"),
    ]);
    expect(nameCommunity(["a", "b"], evidence, entities).label).toBe(
      "Mixed merchant links",
    );
  });
  it("does not use spending categories to describe device-only connections", () => {
    const { evidence, entities } = sample([
      payment("a", "ma", "D17"),
      payment("b", "mb", "D17"),
      ...background,
    ]);
    const result = nameCommunity(["a", "b"], evidence, entities);
    expect(result.label).toBe("Shared devices");
    expect(result.reason).not.toContain("Grocery links");
    expect(result.reason).toContain("2 of 2 accounts");
  });

  it("aggregates multiple merchants into connection categories and compares whole sectors", () => {
    const { evidence, entities } = sample([
      payment("a", "Target", "da", "retail"),
      payment("b", "Target", "db", "retail"),
      payment("b", "Best Buy", "db", "retail"),
      payment("c", "Best Buy", "dc", "retail"),
      payment("x", "Water", "dx", "utilities"),
      payment("y", "Water", "dy", "utilities"),
    ]);
    const results = nameCommunities(
      [
        ["a", "b", "c"],
        ["x", "y"],
      ],
      evidence,
      entities,
    );
    expect(results.map((r) => r.label)).toEqual([
      "Retail-linked accounts",
      "Utility-linked accounts",
    ]);
    expect(results[0]!.reason).toContain("3 of 3 accounts");
    expect(results[0]!.reason).toContain(
      "100% of distinguishing connection evidence here versus 0%",
    );
    expect(results[0]!.reason).toContain("Target");
    expect(results[0]!.reason).toContain("Best Buy");
  });

  it("does not claim a distinction when both communities have the same connection categories", () => {
    const { evidence, entities } = sample([
      payment("a", "Target", "da", "retail"),
      payment("b", "Target", "db", "retail"),
      payment("c", "Best Buy", "dc", "retail"),
      payment("d", "Best Buy", "dd", "retail"),
    ]);
    const results = nameCommunities(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      evidence,
      entities,
    );
    expect(results.map((r) => r.label)).toEqual([
      "Mixed merchant links",
      "Mixed merchant links",
    ]);
    expect(results[0]!.reason).toContain(
      "100% of distinguishing connection evidence here versus 100%",
    );
  });

  it("does not let three strongly connected accounts name a ten-account community", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `a${i}`);
    const rows = ids.map((id) => payment(id, "background", `d${id}`, "other"));
    for (const id of ids.slice(0, 3))
      rows.push(payment(id, "special", `d${id}`, "retail"));
    rows.push(
      payment("x", "outside", "dx", "travel"),
      payment("y", "outside", "dy", "travel"),
    );
    const { evidence, entities } = sample(rows);
    const result = nameCommunity(ids, evidence, entities);
    expect(result.label).toBe("Mixed merchant links");
    expect(result.reason).toContain(
      "Retail links: substantial links for 3 of 10 accounts",
    );
  });

  it("preserves source categories and is unaffected by repeated transactions", () => {
    const rows: Payment[] = [
      payment("a", "Music", "da", "other"),
      payment("b", "Music", "db", "other"),
    ].map((p) => ({ ...p, sourceCategory: "subscriptions" }));
    rows.push(
      payment("x", "Water", "dx", "utilities"),
      payment("y", "Water", "dy", "utilities"),
    );
    const before = sample(rows),
      after = sample([
        ...rows,
        ...Array.from({ length: 1000 }, () => rows[0]!),
      ]);
    const result = nameCommunity(["a", "b"], before.evidence, before.entities);
    expect(result.label).toBe("Subscription-linked accounts");
    expect(nameCommunity(["a", "b"], after.evidence, after.entities)).toEqual(
      result,
    );
  });

  it("does not attribute a mixed-category merchant to an invented single category", () => {
    const { evidence, entities } = sample([
      payment("a", "Walmart", "da", "retail"),
      payment("b", "Walmart", "db", "groceries"),
      payment("x", "Water", "dx", "utilities"),
      payment("y", "Water", "dy", "utilities"),
    ]);
    const result = nameCommunity(["a", "b"], evidence, entities);
    expect(result.label).toBe("Mixed merchant links");
    expect(result.reason).toContain("Mixed links");
    expect(result.reason).not.toContain("Grocery links");
  });

  it("excludes universally used merchants and unknown devices", () => {
    const { evidence, entities } = sample(
      ["a", "b", "c", "d"]
        .map((id) => ({
          ...payment(id, "Everywhere", "unknown"),
          unavailableRules: ["shared_device_accounts"] as const,
        }))
        .map((p) => ({ ...p, unavailableRules: [...p.unavailableRules] })),
    );
    expect(evidence.edges).toEqual([]);
    expect(nameCommunity(["a", "b"], evidence, entities).label).toBe(
      "Account group",
    );
  });

  it("falls back to merchant categories when source and payment categories are missing", () => {
    const { scenario, entities } = sample([
      payment("a", "Shop", "da"),
      payment("b", "Shop", "db"),
      payment("c", "Water", "dc"),
      payment("d", "Water", "dd"),
    ]);
    for (const e of entities.values())
      if (e.type === "merchant")
        e.category = e.id === "Shop" ? "retail" : "utilities";
    for (const p of scenario.payments) {
      delete p.category;
      delete p.sourceCategory;
    }
    const evidence = communityEvidence(scenario.payments, entities);
    expect(nameCommunity(["a", "b"], evidence, entities).label).toBe(
      "Retail-linked accounts",
    );
  });

  it("retains duplicate references, memberships and deterministic ordering", () => {
    const rows: Payment[] = [];
    for (const prefix of ["x", "y"])
      for (let a = 0; a < 6; a++)
        for (let b = a + 1; b < 6; b++)
          for (const i of [a, b])
            rows.push(
              payment(`${prefix}${i}`, `m${prefix}${i}`, `d${prefix}${a}${b}`),
            );
    const { scenario } = sample(rows),
      root = buildHierarchy(scenario);
    expect(root.children.map((g) => g.label)).toEqual([
      "Shared devices",
      "Shared devices",
    ]);
    expect(root.children.map(groupLabel)).toEqual([
      "Shared devices 1",
      "Shared devices 2",
    ]);
    expect(root.children.map((g) => g.payments.length)).toEqual([30, 30]);
    expect(
      buildHierarchy({
        ...scenario,
        payments: [...scenario.payments].reverse(),
        nodes: [...scenario.nodes].reverse(),
      }),
    ).toEqual(root);
  });
});
