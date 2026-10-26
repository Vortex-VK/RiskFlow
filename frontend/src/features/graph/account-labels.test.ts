import { expect, it } from "vitest";
import { accountLabels } from "./account-labels";

it("numbers matching account initials in document order without counting other object types", () => {
  const nodes = [
    { id: "a", type: "account", name: "Alex Morgan" },
    { id: "shop", type: "merchant", name: "Acme" },
    { id: "b", type: "account", name: "  alice Smith" },
    { id: "c", type: "account", name: "Casey Reed" },
  ] as const;
  expect([...accountLabels(nodes)]).toEqual([
    ["a", "A1"],
    ["b", "A2"],
    ["c", "C"],
  ]);
  expect([...accountLabels(nodes.filter((n) => n.id !== "b"))]).toEqual([
    ["a", "A"],
    ["c", "C"],
  ]);
  expect(nodes[0].name).toBe("Alex Morgan");
});

it("handles identical names, double-digit suffixes and canonically equivalent initials", () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    type: "account" as const,
    name: "Alex",
  }));
  expect([...accountLabels(nodes).values()]).toEqual([
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "A9",
    "A10",
    "A11",
    "A12",
  ]);
  expect([
    ...accountLabels([
      { id: "a", type: "account", name: "Émile" },
      { id: "b", type: "account", name: "E\u0301lodie" },
    ]).values(),
  ]).toEqual(["É1", "É2"]);
});
