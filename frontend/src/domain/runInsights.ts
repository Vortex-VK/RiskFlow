import { needsReview, type ReviewEvent } from "./review";
import type { Scenario } from "./types";

type InsightEvent = ReviewEvent & {
  eventId: string;
  accountId: string;
  merchantId: string;
  amountMinor: number;
};
export type ReviewGroup = {
  label: string;
  eventIds: readonly string[];
  visibleOnly?: boolean;
};
export const patternDefinitions = [
  {
    id: "repeat",
    label: "Repeat merchant attempts",
    description:
      "An earlier attempt by the same account at this merchant within 5 minutes.",
  },
  {
    id: "burst",
    label: "Rapid account activity",
    description:
      "At least 3 earlier attempts by the same account within 5 minutes.",
  },
  {
    id: "channel",
    label: "Payment channel changes",
    description:
      "A different channel from the account’s most recent earlier attempt.",
  },
  {
    id: "device",
    label: "Previously shared devices",
    description:
      "A supplied device previously used by another account in this CSV.",
  },
] as const;
type Pattern = (typeof patternDefinitions)[number]["id"];
type Window = { times: number[]; head: number };

/** Equal-time payments see the same strictly earlier history, independent of input order. */
export function findInvestigationPatterns(payments: Scenario["payments"]) {
  const matches = new Map<string, ReadonlySet<Pattern>>();
  const accounts = new Map<string, Window>();
  const merchants = new Map<string, Window>();
  const channels = new Map<string, Set<string | undefined>>();
  const devices = new Map<string, Set<string>>();
  const sorted = [...payments].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  const count = (windows: Map<string, Window>, key: string, time: number) => {
    const window = windows.get(key);
    if (!window) return 0;
    while (
      window.head < window.times.length &&
      window.times[window.head]! < time - 300000
    )
      window.head++;
    return window.times.length - window.head;
  };
  const add = (windows: Map<string, Window>, key: string, time: number) => {
    const window = windows.get(key) ?? { times: [], head: 0 };
    window.times.push(time);
    windows.set(key, window);
  };
  let missingDevice = 0;
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (
      end < sorted.length &&
      sorted[end]!.occurredAt === sorted[start]!.occurredAt
    )
      end++;
    const batchChannels = new Map<string, Set<string | undefined>>();
    for (let i = start; i < end; i++) {
      const p = sorted[i]!;
      const time = Date.parse(p.occurredAt);
      const found = new Set<Pattern>();
      if (!p.unavailableRules?.includes("payment_velocity")) {
        if (count(accounts, p.accountId, time) >= 3) found.add("burst");
        if (count(merchants, JSON.stringify([p.accountId, p.merchantId]), time))
          found.add("repeat");
        const previous = channels.get(p.accountId);
        if (
          (p.rankingInput?.channel || p.modelInput?.channel) &&
          previous?.size === 1 &&
          !previous.has(undefined) &&
          !previous.has(p.rankingInput?.channel || p.modelInput?.channel)
        )
          found.add("channel");
      }
      if (
        p.deviceId &&
        !p.unavailableRules?.includes("shared_device_accounts")
      ) {
        const previous = devices.get(p.deviceId);
        if (previous && (previous.size > 1 || !previous.has(p.accountId)))
          found.add("device");
      } else missingDevice++;
      matches.set(p.id, found);
    }
    for (let i = start; i < end; i++) {
      const p = sorted[i]!;
      const time = Date.parse(p.occurredAt);
      if (!p.unavailableRules?.includes("payment_velocity")) {
        add(accounts, p.accountId, time);
        add(merchants, JSON.stringify([p.accountId, p.merchantId]), time);
      }
      const channelSet =
        batchChannels.get(p.accountId) ?? new Set<string | undefined>();
      channelSet.add(
        p.unavailableRules?.includes("payment_velocity")
          ? undefined
          : p.rankingInput?.channel || p.modelInput?.channel,
      );
      batchChannels.set(p.accountId, channelSet);
      if (
        p.deviceId &&
        !p.unavailableRules?.includes("shared_device_accounts")
      ) {
        const deviceAccounts = devices.get(p.deviceId) ?? new Set<string>();
        deviceAccounts.add(p.accountId);
        devices.set(p.deviceId, deviceAccounts);
      }
    }
    for (const [account, channelSet] of batchChannels)
      channels.set(account, channelSet);
    start = end;
  }
  return { matches, missingDevice };
}

export function summarizeInsights(
  events: readonly InsightEvent[],
  patterns: ReturnType<typeof findInvestigationPatterns>,
  threshold: number | null,
) {
  const flagged = events.filter((e) => needsReview(e, threshold));
  const concentrate = (key: "accountId" | "merchantId") => {
    const groups = new Map<
      string,
      { id: string; total: number; amount: number; eventIds: string[] }
    >();
    for (const e of events) {
      const group = groups.get(e[key]) ?? {
        id: e[key],
        total: 0,
        amount: 0,
        eventIds: [],
      };
      group.total++;
      if (needsReview(e, threshold)) {
        group.amount += e.amountMinor;
        group.eventIds.push(e.eventId);
      }
      groups.set(group.id, group);
    }
    return [...groups.values()]
      .filter((g) => g.eventIds.length)
      .sort(
        (a, b) =>
          b.eventIds.length - a.eventIds.length ||
          b.amount - a.amount ||
          a.id.localeCompare(b.id),
      );
  };
  return {
    flagged: flagged.length,
    accounts: concentrate("accountId"),
    merchants: concentrate("merchantId"),
    patterns: patternDefinitions
      .map((definition) => {
        const matching = flagged.filter((e) =>
          patterns.matches.get(e.eventId)?.has(definition.id),
        );
        return {
          ...definition,
          eventIds: matching.map((e) => e.eventId),
          amount: matching.reduce((sum, e) => sum + e.amountMinor, 0),
        };
      })
      .filter((p) => p.eventIds.length),
  };
}
