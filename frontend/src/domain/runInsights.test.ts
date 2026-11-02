import { expect, it } from "vitest";
import { findInvestigationPatterns, summarizeInsights } from "./runInsights";
import type { Payment } from "./types";

const payment = (
  id: string,
  seconds: number,
  overrides: Partial<Payment> = {},
): Payment => ({
  id,
  accountId: "a",
  merchantId: "m",
  deviceId: "device",
  locationId: "home",
  amountMinor: 100,
  occurredAt: new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString(),
  modelInput: {
    channel: "Chip Transaction",
    completed: true,
    mcc: "5734",
    merchantCity: "",
    merchantState: "",
    merchantZip: "",
  },
  ...overrides,
});
const event = (p: Payment, value = 95) => ({
  ...p,
  eventId: p.id,
  decision: "approve",
  model: { alert: value >= 90, score: { value, probabilityAvailable: true } },
});

it("uses earlier unflagged history, inclusive five-minute boundaries and no future payments", () => {
  const payments = [
    payment("first", 0),
    payment("second", 10),
    payment("third", 20),
    payment("flag", 300),
    payment("later", 601),
  ];
  const patterns = findInvestigationPatterns(payments);
  expect([...patterns.matches.get("first")!]).toEqual([]);
  expect(patterns.matches.get("flag")).toEqual(new Set(["repeat", "burst"]));
  expect(patterns.matches.get("later")!.has("repeat")).toBe(false);
  const result = summarizeInsights(
    payments.map((p) => event(p, p.id === "flag" ? 95 : 10)),
    patterns,
    null,
  );
  expect(result.accounts[0]).toMatchObject({
    total: 5,
    amount: 100,
    eventIds: ["flag"],
  });
  expect(result.patterns.map((p) => p.eventIds)).toEqual([["flag"], ["flag"]]);
  expect(
    summarizeInsights(
      payments.map((p) => event(p)),
      patterns,
      100,
    ).patterns,
  ).toEqual([]);
});

it("does not invent order for simultaneous attempts, device sharing, or ambiguous channels", () => {
  const first = payment("first", 0);
  const simultaneous = payment("simultaneous", 0, { accountId: "b" });
  const chip = payment("chip", 60);
  const online = payment("online", 60, {
    modelInput: { ...first.modelInput!, channel: "Online Transaction" },
  });
  const last = payment("last", 120);
  const payments = [first, simultaneous, chip, online, last];
  const forward = findInvestigationPatterns(payments);
  const reverse = findInvestigationPatterns([...payments].reverse());
  expect(forward.matches).toEqual(reverse.matches);
  expect(forward.matches.get("simultaneous")!.has("device")).toBe(false);
  expect(forward.matches.get("chip")!.has("device")).toBe(true);
  expect(forward.matches.get("online")!.has("channel")).toBe(true);
  expect(forward.matches.get("last")!.has("channel")).toBe(false);
  expect(payments[0]).toBe(first);
});

it("excludes missing device placeholders and imprecise timestamps", () => {
  const unavailableRules: Payment["unavailableRules"] = [
    "shared_device_accounts",
    "payment_velocity",
  ];
  const payments = [
    payment("a", 0, { unavailableRules }),
    payment("b", 60, { accountId: "b", unavailableRules }),
    payment("c", 120),
  ];
  const result = findInvestigationPatterns(payments);
  expect(result.missingDevice).toBe(2);
  for (const found of result.matches.values()) expect(found.size).toBe(0);
});

it("keeps counts, amounts and threshold groups separate from outcome labels", () => {
  const payments = [
    payment("a", 0),
    payment("b", 30, { merchantId: "other", amountMinor: 300 }),
    payment("c", 40, { accountId: "other" }),
  ];
  const events = payments.map((p, i) => event(p, [95, 50, 10][i]!));
  const patterns = findInvestigationPatterns(payments);
  const original = JSON.stringify(events);
  const defaults = summarizeInsights(events, patterns, null);
  expect(defaults.flagged).toBe(1);
  expect(defaults.accounts[0]).toMatchObject({
    total: 2,
    amount: 100,
    eventIds: ["a"],
  });
  const preview = summarizeInsights(events, patterns, 50);
  expect(preview.flagged).toBe(2);
  expect(preview.accounts[0]).toMatchObject({
    total: 2,
    amount: 400,
    eventIds: ["a", "b"],
  });
  expect(preview.merchants.map((g) => g.id)).toEqual(["other", "m"]);
  expect(JSON.stringify(events)).toBe(original);
});
