import type { TransactionGroup } from "../../../domain/hierarchy";
import type { Entity } from "../../../domain/types";

type ObjectOrigins = Record<string, readonly string[]>;

// Payment IDs survive regrouping; numbered sector paths do not.
export function sectorObjectScope(
  root: TransactionGroup,
  current: TransactionGroup,
  nodes: Entity[],
  origins: ObjectOrigins,
) {
  const paymentSectors = new Map<string, string>();
  let firstLeaf = root.id;
  function visit(group: TransactionGroup) {
    if (group.children.length) group.children.forEach(visit);
    else {
      if (!paymentSectors.size) firstLeaf = group.id;
      group.payments.forEach((payment) =>
        paymentSectors.set(payment.id, group.id),
      );
    }
  }
  visit(root);
  const scope = new Set(current.entityIds);
  for (const node of nodes) {
    if (root.entityIds.has(node.id)) continue;
    const anchor = origins[node.id]?.find((id) => paymentSectors.has(id));
    // Unassigned imports, or objects whose original payments were all removed,
    // remain reachable in one deterministic sector instead of every sector.
    const owner = anchor ? paymentSectors.get(anchor) : firstLeaf;
    if (owner === current.id) scope.add(node.id);
  }
  return scope;
}
