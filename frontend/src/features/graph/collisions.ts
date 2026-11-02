import type { Entity, Position } from "../../domain/types";
import { collisionRadius } from "./geometry";

export type Contact = { id: string; nx: number; ny: number; strength: number };

export function pushObjects(
  nodes: readonly Pick<Entity, "id" | "type">[],
  positions: Record<string, Position>,
  heldId: string,
  destination: Position,
) {
  return pushCircles(
    nodes.map((node) => ({ id: node.id, radius: collisionRadius(node) })),
    positions,
    heldId,
    destination,
  );
}

function pushCircles(
  bodies: readonly { id: string; radius: number }[],
  positions: Record<string, Position>,
  heldId: string,
  destination: Position,
  gap = 4,
  stepSize = 8,
) {
  const next = { ...positions };
  const origin = positions[heldId]!;
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / stepSize));
  const contacts = new Map<string, Contact>();
  const touched = new Set([heldId]);
  const contact = (
    id: string,
    nx: number,
    ny: number,
    depth: number,
    radius: number,
  ) => {
    const strength = Math.min(0.65, depth / radius);
    if (strength > (contacts.get(id)?.strength || 0))
      contacts.set(id, { id, nx, ny, strength });
  };
  for (let step = 1; step <= steps; step++) {
    next[heldId] = {
      x: origin.x + (dx * step) / steps,
      y: origin.y + (dy * step) / steps,
    };
    for (let pass = 0; pass < bodies.length * 2; pass++) {
      const center = next[heldId]!;
      const ordered = [...bodies].sort((a, b) => {
        if (a.id === heldId) return -1;
        if (b.id === heldId) return 1;
        const pa = next[a.id]!,
          pb = next[b.id]!;
        return (
          Math.hypot(pa.x - center.x, pa.y - center.y) -
          Math.hypot(pb.x - center.x, pb.y - center.y)
        );
      });
      let changed = false;
      for (let i = 0; i < ordered.length; i++) {
        const a = ordered[i]!;
        for (let j = i + 1; j < ordered.length; j++) {
          const b = ordered[j]!;
          if (!touched.has(a.id) && !touched.has(b.id)) continue;
          const pa = next[a.id]!,
            pb = next[b.id]!;
          const length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          const depth = a.radius + b.radius + gap - length;
          if (depth <= 0.001) continue;
          const nx =
            length > 0.0001
              ? (pb.x - pa.x) / length
              : distance
                ? dx / distance
                : Math.cos(j * 2.399963);
          const ny =
            length > 0.0001
              ? (pb.y - pa.y) / length
              : distance
                ? dy / distance
                : Math.sin(j * 2.399963);
          next[b.id] = { x: pb.x + nx * depth, y: pb.y + ny * depth };
          touched.add(b.id);
          contact(a.id, nx, ny, depth, a.radius);
          contact(b.id, -nx, -ny, depth, b.radius);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
  return { positions: next, contacts: [...contacts.values()] };
}
