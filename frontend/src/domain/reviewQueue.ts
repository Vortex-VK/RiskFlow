import type { DeepReadonly, EventResult } from "./runs";

type Event = DeepReadonly<EventResult>;

/** A workload suggestion from score separation, never an estimate of fraud prevalence. */
export function suggestCapacity(scores: readonly number[]) {
  if (!scores.length) return { count: 0, reason: "empty" as const };
  if (scores.some((s) => !Number.isFinite(s)))
    throw new Error("Review scores must be finite.");
  const sorted = [...scores].sort((a, b) => a - b);
  if (sorted[0] === sorted.at(-1)) return { count: 0, reason: "flat" as const };
  if (scores.length < 20)
    return { count: Math.ceil(scores.length * 0.01), reason: "small" as const };
  const quantile = (p: number) => {
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i);
    return sorted[lo]! + (sorted[Math.ceil(i)]! - sorted[lo]!) * (i - lo);
  };
  const q1 = quantile(0.25),
    q3 = quantile(0.75);
  // Conventional Tukey upper fence. No label or probability enters this rule.
  const fence = q3 + 1.5 * (q3 - q1);
  return {
    count: sorted.filter((s) => s > fence).length,
    reason: "tail" as const,
  };
}

export function rankedQueue(
  events: readonly Event[],
  sourceIds: ReadonlyMap<string, string> = new Map(),
) {
  const ordered = events
    .filter((e) => e.model?.ranking)
    .slice()
    .sort((a, b) => {
      const difference =
        b.model!.ranking!.rawMargin - a.model!.ranking!.rawMargin;
      const left = sourceIds.get(a.eventId) ?? a.eventId;
      const right = sourceIds.get(b.eventId) ?? b.eventId;
      return difference || (left < right ? -1 : left > right ? 1 : 0);
    });
  return {
    ordered,
    ranks: new Map(ordered.map((e, i) => [e.eventId, i + 1])),
    suggestion: suggestCapacity(
      ordered.map((e) => e.model!.ranking!.rawMargin),
    ),
  };
}

/** Presentation-only queue: immutable recorded assessments and scores stay intact. */
export function applyCapacity(
  events: readonly Event[],
  ranks: ReadonlyMap<string, number>,
  count: number,
): readonly Event[] {
  return events.map((event) => {
    const rank = ranks.get(event.eventId);
    if (rank === undefined || !event.model) return event;
    const alert = rank <= count;
    return {
      ...event,
      decision: alert ? "review" : "approve",
      model: { ...event.model, alert },
    };
  });
}
