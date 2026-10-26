import type { Entity } from "../../domain/types";

export const accountInitial = (name: string) =>
  Array.from(name.trim().normalize("NFC").toUpperCase())[0] || "?";

export function accountLabels(
  nodes: readonly Pick<Entity, "id" | "name" | "type">[],
): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.type !== "account") continue;
    const initial = accountInitial(node.name);
    const ids = groups.get(initial) || [];
    ids.push(node.id);
    groups.set(initial, ids);
  }
  const labels = new Map<string, string>();
  for (const [initial, ids] of groups)
    ids.forEach((id, index) =>
      labels.set(id, ids.length > 1 ? `${initial}${index + 1}` : initial),
    );
  return labels;
}
