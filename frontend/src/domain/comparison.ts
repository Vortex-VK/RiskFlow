import type { DeepReadonly, EventResult, Run } from "./runs";
import type { Scenario } from "./types";

export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, sort(val)]),
          )
        : v;
  return JSON.stringify(sort(value));
}
const facts = (s: DeepReadonly<Scenario>) => ({
  start: s.scenarioStartAt,
  nodes: [...s.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) =>
      Object.fromEntries(
        Object.entries(node)
          .filter(
            ([key]) => !["name", "description", "regionLabel"].includes(key),
          )
          .map(([key, value]) => [
            key,
            Array.isArray(value) ? [...value].sort() : value,
          ]),
      ),
    ),
  associations: [...s.associations].sort((a, b) => a.id.localeCompare(b.id)),
  payments: [...s.payments]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((payment) => ({
      ...payment,
      category: payment.category ?? null,
      sourceCategory: undefined,
      unavailableRules: [...(payment.unavailableRules || [])].sort(),
    })),
});
type EventDelta = {
  id: string;
  before: DeepReadonly<EventResult> | undefined;
  after: DeepReadonly<EventResult> | undefined;
  reasons: string[];
  changed: boolean;
};
export function compareRuns(
  before: DeepReadonly<Run>,
  after: DeepReadonly<Run>,
) {
  if (before.scenarioSnapshot.id !== after.scenarioSnapshot.id)
    throw new Error("Compare runs of the same scenario.");
  const a = before.scenarioSnapshot,
    b = after.scenarioSnapshot;
  const basis: string[] = [];
  const factsA = facts(a),
    factsB = facts(b);
  const paymentsA = new Map(factsA.payments.map((p) => [p.id, p])),
    paymentsB = new Map(factsB.payments.map((p) => [p.id, p]));
  const factsChanged = canonical(factsA) !== canonical(factsB);
  const policyChanged = canonical(a.policy) !== canonical(b.policy);
  const labelsChanged = canonical(a.groundTruth) !== canonical(b.groundTruth);
  if (factsChanged) basis.push("Scenario facts changed");
  if (labelsChanged) basis.push("Labels changed");
  if (canonical(a.costAssumptions) !== canonical(b.costAssumptions))
    basis.push("Cost assumptions changed");
  if (
    before.engineVersion !== after.engineVersion ||
    before.ruleSetVersion !== after.ruleSetVersion
  )
    basis.push("Engine/rules changed");
  if (policyChanged)
    basis.push(basis.length ? "Policy changed" : "Policy only");
  if (!basis.length) basis.push("Same analytical inputs");
  const prior = new Map(before.events.map((e) => [e.eventId, e]));
  const next = new Map(after.events.map((e) => [e.eventId, e]));
  const contextIndex = (
    s: DeepReadonly<Scenario>,
    value: ReturnType<typeof facts>,
  ) => {
    const nodes = new Map(value.nodes.map((n) => [String(n.id), n]));
    const associations = new Map(
      value.associations.map((r) => [`${r.accountId}:${r.targetId}`, r]),
    );
    const cache = new Map<string, string>();
    return (e: DeepReadonly<EventResult>) => {
      const key = [e.accountId, e.merchantId, e.deviceId, e.locationId].join(
        ":",
      );
      if (!cache.has(key))
        cache.set(
          key,
          canonical({
            nodes: [e.accountId, e.merchantId, e.deviceId, e.locationId]
              .sort()
              .map((id) => nodes.get(id)),
            associations: [e.deviceId, e.locationId]
              .map((id) => associations.get(`${e.accountId}:${id}`)!)
              .sort((a, b) => a.id.localeCompare(b.id)),
            scenarioStartAt: s.scenarioStartAt,
          }),
        );
      return cache.get(key)!;
    };
  };
  const contextBefore = contextIndex(a, factsA),
    contextAfter = contextIndex(b, factsB);
  const sameHistoryFields = (
    a: DeepReadonly<EventResult> | undefined,
    b: DeepReadonly<EventResult> | undefined,
  ) =>
    a &&
    b &&
    a.occurredAt === b.occurredAt &&
    a.accountId === b.accountId &&
    a.deviceId === b.deviceId;
  const changedHistory = [...new Set([...prior.keys(), ...next.keys()])]
    .filter((id) => !sameHistoryFields(prior.get(id), next.get(id)))
    .map((id) => ({ before: prior.get(id), after: next.get(id) }));
  const inWindow = (
    candidate: DeepReadonly<EventResult> | undefined,
    event: DeepReadonly<EventResult>,
  ) =>
    !!candidate &&
    candidate.sequenceIndex < event.sequenceIndex &&
    (candidate.accountId === event.accountId ||
      candidate.deviceId === event.deviceId) &&
    Date.parse(candidate.occurredAt) >= Date.parse(event.occurredAt) - 300000;
  const history = (r: DeepReadonly<Run>, e: DeepReadonly<EventResult>) =>
    r.events
      .slice(0, e.sequenceIndex)
      .filter(
        (p) =>
          Date.parse(p.occurredAt) >= Date.parse(e.occurredAt) - 300000 &&
          (p.accountId === e.accountId || p.deviceId === e.deviceId),
      )
      .map((p) => ({
        id: p.eventId,
        time: p.occurredAt,
        account: p.accountId,
        device: p.deviceId,
      }));
  const events: EventDelta[] = [
    ...new Set([...next.keys(), ...prior.keys()]),
  ].map((id) => {
    const old = prior.get(id),
      current = next.get(id);
    const reasons: string[] = [];
    if (!old) reasons.push("Added payment");
    else if (!current) reasons.push("Removed payment");
    else {
      if (canonical(paymentsA.get(id)) !== canonical(paymentsB.get(id)))
        reasons.push("Payment fields changed");
      if (contextBefore(old) !== contextAfter(current))
        reasons.push("Referenced context changed");
      if (
        sameHistoryFields(old, current)
          ? changedHistory.some(
              (p) => inWindow(p.before, old) || inWindow(p.after, current),
            )
          : canonical(history(before, old)) !==
            canonical(history(after, current))
      )
        reasons.push("Earlier payment history changed");
      if (a.groundTruth[id] !== b.groundTruth[id])
        reasons.push("Synthetic label changed");
    }
    return {
      id,
      before: old,
      after: current,
      reasons,
      changed:
        reasons.length > 0 ||
        old?.riskScore !== current?.riskScore ||
        canonical(old?.model) !== canonical(current?.model) ||
        old?.decision !== current?.decision,
    };
  });
  const transitions: Record<string, number> = {};
  for (const e of events)
    if (e.before && e.after && e.before.decision !== e.after.decision) {
      const key = `${e.before.decision} → ${e.after.decision}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }
  return {
    basis,
    events,
    transitions,
    labelsChanged,
    coverageChanged:
      canonical(Object.keys(a.groundTruth).sort()) !==
      canonical(Object.keys(b.groundTruth).sort()),
    populationChanged:
      canonical([...prior.keys()].sort()) !==
      canonical([...next.keys()].sort()),
    added: events.filter((e) => !e.before).length,
    removed: events.filter((e) => !e.after).length,
  };
}

export const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
export function rateDifference(
  a: { numerator: number; denominator: number } | null,
  b: { numerator: number; denominator: number } | null,
) {
  if (!a?.denominator || !b?.denominator) return null;
  return 100 * (b.numerator / b.denominator - a.numerator / a.denominator);
}
