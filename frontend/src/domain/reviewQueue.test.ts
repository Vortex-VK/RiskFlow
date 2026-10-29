import { describe, expect, it } from "vitest";
import { applyCapacity, rankedQueue, suggestCapacity } from "./reviewQueue";
import fixture from "../../../fixtures/runtime/stack-d5/run.json";
import type { EventResult } from "./runs";

describe("upload review capacity", () => {
  it("does not force alerts when scores do not separate", () => {
    expect(suggestCapacity([]).count).toBe(0);
    expect(suggestCapacity(Array(100).fill(3)).count).toBe(0);
    expect(
      suggestCapacity(Array.from({ length: 100 }, (_, i) => i)).count,
    ).toBe(0);
  });
  it("uses the conventional upper fence and is invariant to positive affine scaling", () => {
    const scores = [
      ...Array.from({ length: 96 }, (_, i) => i / 100),
      8,
      9,
      10,
      11,
    ];
    expect(suggestCapacity(scores)).toEqual({ count: 4, reason: "tail" });
    expect(suggestCapacity(scores.map((s) => 2 * s + 100))).toEqual(
      suggestCapacity(scores),
    );
    expect(suggestCapacity([1, 2, 3])).toEqual({ count: 1, reason: "small" });
  });
  it("uses stable source IDs for ties, grows monotonically, and never mutates saved decisions", () => {
    const events = fixture.events as EventResult[];
    const before = JSON.stringify(events);
    const queue = rankedQueue(events);
    const small = applyCapacity(events, queue.ranks, 2).filter(
      (e) => e.model?.alert,
    );
    const large = applyCapacity(events, queue.ranks, 4).filter(
      (e) => e.model?.alert,
    );
    expect(small).toHaveLength(2);
    expect(large).toHaveLength(4);
    expect(small.every((e) => large.some((l) => l.eventId === e.eventId))).toBe(
      true,
    );
    expect(
      applyCapacity(events, queue.ranks, 0).some((e) => e.model?.alert),
    ).toBe(false);
    expect(JSON.stringify(events)).toBe(before);
    const tie = [events[0]!, { ...events[0]!, eventId: "another" }];
    const ids = new Map([
      [tie[0]!.eventId, "z"],
      ["another", "a"],
    ]);
    expect(rankedQueue(tie, ids).ordered[0]!.eventId).toBe("another");
  });
});
