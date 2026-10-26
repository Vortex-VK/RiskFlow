import { describe, expect, it } from "vitest";
import { pushObjects } from "./collisions";
import { collisionRadius } from "./geometry";

const nodes = ["a", "b", "c", "far"].map((id) => ({
  id,
  type: "account" as const,
}));
const positions = {
  a: { x: 0, y: 0 },
  b: { x: 80, y: 0 },
  c: { x: 150, y: 0 },
  far: { x: 500, y: 500 },
};

describe("object pushing", () => {
  it("pushes a touching chain, keeps the held object at the pointer and leaves unrelated positions unchanged", () => {
    const result = pushObjects(nodes, positions, "a", { x: 90, y: 0 });
    expect(result.positions).toEqual({
      a: { x: 90, y: 0 },
      b: { x: 158, y: 0 },
      c: { x: 226, y: 0 },
      far: { x: 500, y: 500 },
    });
    expect(positions.b).toEqual({ x: 80, y: 0 });
    expect(result.contacts.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(result.contacts.find((c) => c.id === "a")?.nx).toBe(1);
    expect(result.contacts.find((c) => c.id === "c")?.nx).toBe(-1);
  });

  it("sweeps fast pointer jumps so objects cannot tunnel through each other", () => {
    const result = pushObjects(nodes, positions, "a", { x: 300, y: 0 });
    expect(result.positions.b!.x).toBeCloseTo(368, 3);
    expect(result.positions.c!.x).toBeCloseTo(436, 3);
  });

  it("does not attract objects or move an unrelated overlapping pair", () => {
    const source = { ...positions, c: positions.far };
    const result = pushObjects(nodes, source, "a", { x: -100, y: -100 });
    expect(result.positions).toEqual({ ...source, a: { x: -100, y: -100 } });
    expect(result.contacts).toEqual([]);
  });

  it("separates a full stack including rounded devices deterministically without moving the placed object", () => {
    const stack = Array.from({ length: 35 }, (_, i) => ({
      id: `n${i}`,
      type: i % 2 ? ("device" as const) : ("account" as const),
    }));
    const source = Object.fromEntries(
      stack.map((node) => [node.id, { x: 200, y: 200 }]),
    );
    const result = pushObjects(stack, source, "n0", source.n0!);
    expect(result.positions.n0).toEqual({ x: 200, y: 200 });
    for (let i = 0; i < stack.length; i++) {
      const a = stack[i]!,
        pa = result.positions[a.id]!;
      expect(Number.isFinite(pa.x) && Number.isFinite(pa.y)).toBe(true);
      for (const b of stack.slice(i + 1)) {
        const pb = result.positions[b.id]!;
        expect(Math.hypot(pb.x - pa.x, pb.y - pa.y)).toBeGreaterThanOrEqual(
          collisionRadius(a) + collisionRadius(b) + 3.99,
        );
      }
    }
    expect(pushObjects(stack, source, "n0", source.n0!).positions).toEqual(
      result.positions,
    );
  });
});
