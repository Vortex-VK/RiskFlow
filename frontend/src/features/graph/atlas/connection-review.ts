import type { Entity, Payment } from "../../../domain/types";

export function connectionReview(
  payments: readonly Payment[],
  entity: Entity,
  assessedIds: ReadonlySet<string> | undefined,
  flaggedIds: ReadonlySet<string> | undefined,
) {
  const field =
    entity.type === "account"
      ? "accountId"
      : entity.type === "merchant"
        ? "merchantId"
        : entity.type === "device"
          ? "deviceId"
          : "locationId";
  const unique = new Map(
    payments
      .filter(
        (p) =>
          p[field] === entity.id &&
          !(
            entity.type === "device" &&
            p.unavailableRules?.includes("shared_device_accounts")
          ),
      )
      .map((p) => [p.id, p]),
  );
  const rows = [...unique.values()]
    .map((payment) => ({
      payment,
      assessed: assessedIds?.has(payment.id) ?? false,
      flagged: !!assessedIds?.has(payment.id) && !!flaggedIds?.has(payment.id),
    }))
    .sort(
      (a, b) =>
        Number(b.flagged) - Number(a.flagged) ||
        b.payment.occurredAt.localeCompare(a.payment.occurredAt) ||
        a.payment.id.localeCompare(b.payment.id),
    );
  return {
    rows,
    accounts: new Set(rows.map((r) => r.payment.accountId)).size,
    assessed: rows.filter((r) => r.assessed).length,
    flagged: rows.filter((r) => r.flagged).length,
    amount: rows.reduce((sum, r) => sum + r.payment.amountMinor, 0),
    flaggedAmount: rows.reduce(
      (sum, r) => sum + (r.flagged ? r.payment.amountMinor : 0),
      0,
    ),
  };
}
