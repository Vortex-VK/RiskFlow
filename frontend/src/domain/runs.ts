import type { components } from "../api/generated";
import type { Scenario } from "./types";
import { orderedPayments } from "./types";

export type Run = components["schemas"]["RunResult"];
export type EventResult = Run["events"][number];
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, value]) =>
            !(
              value == null &&
              [
                "description",
                "regionLabel",
                "sourceTemplateId",
                "sourceTemplateVersion",
                "category",
                "sourceCategory",
                "modelInput",
                "rankingInput",
              ].includes(key)
            ),
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => [key, stable(value)]),
    );
  return value;
}

export function normalizedScenario(
  scenario: Scenario,
  analytical = false,
): string {
  const s = structuredClone(scenario);
  s.nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const node of s.nodes)
    if (node.type === "account") {
      node.usualCountryCodes.sort();
      node.usualMerchantCategories.sort();
    }
  s.associations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  s.payments = orderedPayments(s.payments);
  for (const payment of s.payments) {
    if (payment.modelInput) {
      payment.modelInput.merchantState ??= "";
      payment.modelInput.merchantCity ??= "";
      payment.modelInput.merchantZip ??= "";
    }
    if (payment.unavailableRules?.length) payment.unavailableRules.sort();
    else delete payment.unavailableRules;
  }
  if (!analytical) return JSON.stringify(stable(s));
  const facts = Object.fromEntries(
    Object.entries(s).filter(
      ([key]) =>
        ![
          "name",
          "description",
          "sourceTemplateId",
          "sourceTemplateVersion",
        ].includes(key),
    ),
  );
  return JSON.stringify(
    stable({
      ...facts,
      nodes: s.nodes.map((node) =>
        Object.fromEntries(
          Object.entries(node).filter(
            ([key]) => !["name", "description", "regionLabel"].includes(key),
          ),
        ),
      ),
      payments: s.payments.map((payment) =>
        Object.fromEntries(Object.entries(payment)),
      ),
    }),
  );
}

export function projectAnalyticalInput(scenario: Scenario): string {
  return normalizedScenario(scenario, true);
}

export const PLAYBACK_SPEEDS: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 5, 10];

export function presentationSchedule(
  events: readonly { occurredAt: string }[],
) {
  let start = 400;
  const schedule = events.map((event, index) => {
    if (index)
      start += Math.max(
        650,
        Math.min(
          1600,
          (Date.parse(event.occurredAt) -
            Date.parse(events[index - 1]!.occurredAt)) *
            0.08,
        ),
      );
    return { start, end: start + 400 };
  });
  const duration = schedule.at(-1)?.end || 0;
  // Preserve small scenarios; progressively shorten large runs while retaining
  // every event. At the existing 1.25 clock rate, the floor is 24 seconds at 1x.
  const budget = Math.max(
    30_000,
    120_000 * Math.sqrt(60 / Math.max(60, events.length)),
  );
  const scale = duration > budget ? budget / duration : 1;
  return schedule.map((s) => ({ start: s.start * scale, end: s.end * scale }));
}

export function playbackPosition(
  schedule: { start: number; end: number }[],
  elapsed: number,
) {
  const cursor = schedule.reduce(
    (last, event, index) => (elapsed >= event.end ? index : last),
    -1,
  );
  const active = schedule.findIndex(
    (event) => elapsed >= event.start && elapsed < event.end,
  );
  const progress =
    active < 0
      ? 0
      : (elapsed - schedule[active]!.start) /
        (schedule[active]!.end - schedule[active]!.start);
  return {
    cursor,
    active,
    progress,
    completed: !!schedule.length && elapsed >= schedule.at(-1)!.end,
  };
}
