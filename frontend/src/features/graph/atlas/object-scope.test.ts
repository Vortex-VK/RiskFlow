import { describe, expect, it } from "vitest";
import hero from "../../../../../fixtures/scenarios/shared-device-cluster.json";
import { decodeDocument } from "../../../api/decode";
import { addNode, newNode } from "../../../domain/commands";
import {
  paymentEntities,
  type TransactionGroup,
} from "../../../domain/hierarchy";
import type { Payment } from "../../../domain/types";
import { useWorkspace } from "../../../state/workspace";
import { sectorObjectScope } from "./object-scope";

const document = decodeDocument(hero);
const p = document.scenario.payments;
const node = newNode("merchant", document.scenario.scenarioStartAt);
const nodes = [...document.scenario.nodes, node];
function group(
  id: string,
  payments: Payment[],
  children: TransactionGroup[] = [],
): TransactionGroup {
  return {
    id,
    label: id,
    reason: "test",
    payments,
    children,
    entityIds: new Set(payments.flatMap(paymentEntities)),
  };
}
const a = group("all/0", [p[0]!]);
const b = group("all/1", [p[1]!, p[2]!]);
const root = group("all", [...a.payments, ...b.payments], [a, b]);

describe("sector ownership of unassigned objects", () => {
  it("keeps new objects in their original sector while payment-linked objects can be shared", () => {
    const origins = { [node.id]: b.payments.map((p) => p.id) };
    expect(sectorObjectScope(root, a, nodes, origins).has(node.id)).toBe(false);
    expect(sectorObjectScope(root, b, nodes, origins).has(node.id)).toBe(true);
    for (const id of a.entityIds)
      expect(sectorObjectScope(root, a, nodes, origins).has(id)).toBe(true);
    for (const id of b.entityIds)
      expect(sectorObjectScope(root, b, nodes, origins).has(id)).toBe(true);
  });

  it("follows surviving payment IDs when sectors are renumbered or split", () => {
    const owner = group("all/0", [p[2]!]);
    const other = group("all/1", [p[0]!]);
    const regrouped = group(
      "all",
      [...owner.payments, ...other.payments],
      [owner, other],
    );
    const origins = { [node.id]: b.payments.map((p) => p.id) };
    expect(
      sectorObjectScope(regrouped, owner, nodes, origins).has(node.id),
    ).toBe(true);
    expect(
      sectorObjectScope(regrouped, other, nodes, origins).has(node.id),
    ).toBe(false);
  });

  it("keeps imported or orphaned objects reachable in exactly one sector", () => {
    for (const origins of [{}, { [node.id]: ["deleted-payment"] }]) {
      expect(sectorObjectScope(root, a, nodes, origins).has(node.id)).toBe(
        true,
      );
      expect(sectorObjectScope(root, b, nodes, origins).has(node.id)).toBe(
        false,
      );
    }
  });

  it("preserves ownership through undo and redo in another sector, and clears it on replacement", () => {
    useWorkspace.getState().replace(document);
    const origin = b.payments.map((payment) => payment.id);
    useWorkspace.setState({ activeSectorPayments: origin });
    useWorkspace
      .getState()
      .commit(addNode(document, node, { x: 100, y: 100 }), "Added merchant");
    expect(useWorkspace.getState().objectOrigins[node.id]).toEqual(origin);
    useWorkspace.setState({
      activeSectorPayments: a.payments.map((payment) => payment.id),
    });
    useWorkspace.getState().undo();
    useWorkspace.getState().redo();
    expect(useWorkspace.getState().objectOrigins[node.id]).toEqual(origin);
    expect(
      useWorkspace
        .getState()
        .document!.scenario.nodes.some((n) => n.id === node.id),
    ).toBe(true);
    useWorkspace.getState().replace(document);
    expect(useWorkspace.getState().objectOrigins).toEqual({});
    expect(useWorkspace.getState().activeSectorPayments).toBeNull();
  });
});
