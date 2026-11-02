import { expect, it } from "vitest";
import type { Entity, Payment } from "../../../domain/types";
import { connectionReview } from "./connection-review";

const device: Entity = {
  id: "shared",
  name: "Shared device",
  type: "device",
  description: "",
};
const p = (
  id: string,
  accountId: string,
  extra: Partial<Payment> = {},
): Payment => ({
  id,
  accountId,
  merchantId: "shop",
  deviceId: "shared",
  locationId: "home",
  amountMinor: 100,
  occurredAt: "2026-10-20T12:00:00.000Z",
  ...extra,
});

it("deduplicates source payments and counts only visibly assessed flags", () => {
  const a = p("a", "one"),
    b = p("b", "two", { amountMinor: 300 });
  const result = connectionReview(
    [a, b, a],
    device,
    new Set(["a"]),
    new Set(["a", "b"]),
  );
  expect(result).toMatchObject({
    accounts: 2,
    amount: 400,
    flaggedAmount: 100,
    assessed: 1,
    flagged: 1,
  });
  expect(result.rows).toHaveLength(2);
  expect(result.rows.find((r) => r.payment.id === "b")).toMatchObject({
    assessed: false,
    flagged: false,
  });
});

it("excludes unavailable shared devices and unrelated payments", () => {
  const result = connectionReview(
    [
      p("unknown", "one", { unavailableRules: ["shared_device_accounts"] }),
      p("other", "two", { deviceId: "other" }),
      p("real", "three"),
    ],
    device,
    undefined,
    new Set(["real"]),
  );
  expect(result.rows.map((r) => r.payment.id)).toEqual(["real"]);
  expect(result.assessed).toBe(0);
  expect(result.flagged).toBe(0);
});

it("updates flags without changing the relationship, payment values or source order", () => {
  const rows = [
    p("a", "one"),
    p("b", "two", { occurredAt: "2026-10-21T12:00:00.000Z" }),
  ];
  const before = JSON.stringify(rows);
  const assessed = new Set(["a", "b"]);
  expect(
    connectionReview(rows, device, assessed, new Set(["a"])).rows.map(
      (r) => r.payment.id,
    ),
  ).toEqual(["a", "b"]);
  const after = connectionReview(rows, device, assessed, new Set());
  expect(after).toMatchObject({
    accounts: 2,
    amount: 200,
    flaggedAmount: 0,
    assessed: 2,
    flagged: 0,
  });
  expect(after.rows.map((r) => r.payment.id)).toEqual(["b", "a"]);
  expect(JSON.stringify(rows)).toBe(before);
});
