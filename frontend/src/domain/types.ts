import type { components } from "../api/generated";
import contract from "../../../contracts/openapi.json" with { type: "json" };

export type Document = components["schemas"]["ScenarioDocument"];
export type Scenario = Document["scenario"];
export type Entity = Scenario["nodes"][number];
export type Payment = Scenario["payments"][number];
export type Association = Scenario["associations"][number];
export type Position = components["schemas"]["Position"];
export type Selection = {
  kind: "node" | "payment" | "association" | "group";
  id: string;
} | null;
export const categories = [
  "groceries",
  "retail",
  "dining",
  "transport",
  "utilities",
  "travel",
  "electronics",
  "other",
] as const;
export const kinds = ["account", "merchant", "device", "location"] as const;
export function country(
  value: string,
): components["schemas"]["MerchantNode"]["countryCode"] {
  const code = value.trim().toUpperCase();
  if (
    !contract.components.schemas.MerchantNode.properties.countryCode.enum.includes(
      code,
    )
  )
    throw new Error("Use a supported two-letter ISO country code.");
  return code as components["schemas"]["MerchantNode"]["countryCode"];
}
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export const money = (minor: number) => usdFormatter.format(minor / 100);
export const orderedPayments = (payments: Payment[]) =>
  [...payments].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
export const groupId = (accountId: string, merchantId: string) =>
  `${accountId}:${merchantId}`;

export function parseMoney(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use a positive USD amount with at most two decimal places.",
    );
  const [whole = "", fraction = ""] = value.split(".");
  const amount = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000)
    throw new Error("Amount must be between $0.01 and $1,000,000.");
  return amount;
}

export function utc(value: string): string {
  const canonical = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?$/.test(
    value,
  )
    ? `${value.length === 16 ? value + ":00" : value}Z`
    : value;
  const date = new Date(canonical);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2100
  )
    throw new Error("Use a valid UTC date between 1900 and 2100.");
  const result = date.toISOString();
  if (result.slice(0, 16) !== value.slice(0, 16))
    throw new Error("This calendar date does not exist.");
  return result;
}
