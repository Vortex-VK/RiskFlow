import { describe, expect, it } from "vitest";
import { partitionCommunities, type WeightedConnection } from "./communities";

const ids = ["a", "b", "c", "d", "e", "f", "isolated"];
const edges: WeightedConnection[] = [
  { a: "a", b: "b", weight: 10 },
  { a: "b", b: "c", weight: 10 },
  { a: "a", b: "c", weight: 10 },
  { a: "d", b: "e", weight: 10 },
  { a: "e", b: "f", weight: 10 },
  { a: "d", b: "f", weight: 10 },
  { a: "c", b: "d", weight: 1 },
];

function modularity(groups: string[][], edges: WeightedConnection[]) {
  const total = edges.reduce((sum, edge) => sum + edge.weight, 0);
  return groups.reduce((sum, group) => {
    const members = new Set(group);
    let internal = 0,
      degree = 0;
    for (const edge of edges) {
      if (members.has(edge.a)) degree += edge.weight;
      if (members.has(edge.b)) degree += edge.weight;
      if (members.has(edge.a) && members.has(edge.b)) internal += edge.weight;
    }
    return sum + internal / total - (degree / (2 * total)) ** 2;
  }, 0);
}

describe("weighted community detection", () => {
  it.each([1e-9, 1, 1e9])(
    "finds connected communities without an absolute weight cutoff at scale %s",
    (scale) => {
      const result = partitionCommunities(
        ids,
        edges.map((e) => ({ ...e, weight: e.weight * scale })),
      );
      expect(result.map((g) => g.accounts)).toEqual([
        ["a", "b", "c"],
        ["d", "e", "f"],
        ["isolated"],
      ]);
      expect(result[0]!.affinity).toBeCloseTo(10 * scale);
    },
  );

  it("does not create communities when there is no relationship evidence", () => {
    expect(partitionCommunities(ids, []).map((g) => g.accounts)).toEqual(
      ids.map((id) => [id]),
    );
  });

  it("keeps a uniformly connected component together without a size quota", () => {
    const accounts = Array.from({ length: 24 }, (_, i) => `account-${i}`);
    const links = accounts.flatMap((a, i) =>
      accounts.slice(i + 1).map((b) => ({ a, b, weight: 1 })),
    );
    expect(
      partitionCommunities(accounts, links).map((g) => g.accounts),
    ).toEqual([[...accounts].sort()]);
  });

  it("matches exhaustive greedy modularity scoring as community degrees change", () => {
    for (let seed = 1; seed <= 8; seed++) {
      let random = seed;
      const nodes = Array.from({ length: 8 }, (_, i) => String(i));
      const links = nodes.flatMap((a, i) =>
        nodes.slice(i + 1).flatMap((b) => {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          const weight = random % 17;
          return weight ? [{ a, b, weight }] : [];
        }),
      );
      let oracle = nodes.map((id) => [id]);
      while (true) {
        let best = oracle,
          quality = modularity(oracle, links);
        for (let a = 0; a < oracle.length; a++)
          for (let b = a + 1; b < oracle.length; b++) {
            const candidate = oracle
              .filter((_, i) => i !== b)
              .map((g, i) => (i === a ? [...g, ...oracle[b]!] : g));
            const score = modularity(candidate, links);
            if (score > quality + 1e-12) {
              best = candidate;
              quality = score;
            }
          }
        if (best === oracle) break;
        oracle = best;
      }
      const actual = partitionCommunities(nodes, links).map((g) => g.accounts);
      expect(modularity(actual, links)).toBeCloseTo(
        modularity(oracle, links),
        10,
      );
      expect(actual.flat().sort()).toEqual(nodes);
    }
  });
});
