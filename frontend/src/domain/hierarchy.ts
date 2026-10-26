import type { Entity, Payment, Scenario } from "./types";
import { orderedPayments } from "./types";
import { LEAF_PAYMENTS } from "./limits";
import { partitionCommunities, type AccountCommunity } from "./communities";
import {
  communityEvidence,
  type CommunityEvidence,
} from "./community-evidence";
import { nameCommunities } from "./community-names";

export type TransactionGroup = {
  id: string;
  label: string;
  reason: string;
  reference?: string;
  payments: Payment[];
  entityIds: Set<string>;
  children: TransactionGroup[];
};

export const paymentEntities = (p: Payment) => [
  p.accountId,
  p.merchantId,
  p.deviceId,
  p.locationId,
];

function buckets(payments: Payment[], key: (p: Payment) => string) {
  const result = new Map<string, Payment[]>();
  for (const payment of payments) {
    const id = key(payment);
    const existing = result.get(id);
    if (existing) existing.push(payment);
    else result.set(id, [payment]);
  }
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// A child is a distinct subgroup only when its internal affinity is materially
// stronger than the parent's. Flatten near-ties instead of exposing arbitrary
// binary merge order as community structure. Otherwise drill into actual accounts.
function strongerSubgroups(community: AccountCommunity): AccountCommunity[] {
  const result: AccountCommunity[] = [];
  function visit(group: AccountCommunity) {
    if (!group.children.length || group.affinity >= community.affinity * 1.5)
      result.push(group);
    else group.children.forEach(visit);
  }
  community.children.forEach(visit);
  return result.sort((a, b) => a.accounts[0]!.localeCompare(b.accounts[0]!));
}

export function buildHierarchy(scenario: Scenario): TransactionGroup {
  const entities = new Map(scenario.nodes.map((n) => [n.id, n]));
  let evidence: CommunityEvidence | undefined;
  const getEvidence = () =>
    (evidence ??= communityEvidence(
      orderedPayments(scenario.payments),
      entities,
    ));
  function build(
    payments: Payment[],
    id: string,
    label: string,
    reason: string,
    communities?: AccountCommunity[],
  ): TransactionGroup {
    const group: TransactionGroup = {
      id,
      label,
      reason,
      payments,
      entityIds: new Set(payments.flatMap(paymentEntities)),
      children: [],
    };
    if (payments.length <= LEAF_PAYMENTS) return group;
    const accounts = new Set(payments.map((p) => p.accountId));
    let partitions: {
      payments: Payment[];
      label: string;
      reason: string;
      communities?: AccountCommunity[];
    }[] = [];
    if (accounts.size > 1) {
      const groups = communities
        ? strongerSubgroups(communities[0]!)
        : partitionCommunities(
            getEvidence().profiles.map((p) => p.id),
            getEvidence().edges,
          );
      const names = nameCommunities(
        groups.map((g) => g.accounts),
        getEvidence(),
        entities,
      );
      partitions = groups.map((community, index) => {
        const ids = community.accounts;
        const members = new Set(ids);
        return {
          payments: payments.filter((p) => members.has(p.accountId)),
          communities: [community],
          ...names[index]!,
        };
      });
    } else {
      const categories = buckets(payments, (p) => {
        const merchant = entities.get(p.merchantId);
        return (
          p.category ??
          (merchant?.type === "merchant" ? merchant.category : "other")
        );
      });
      const merchants = buckets(payments, (p) => p.merchantId);
      const devices = buckets(payments, (p) => p.deviceId);
      const locations = buckets(payments, (p) => p.locationId);
      if (categories.length > 1)
        partitions = categories.map(([label, payments]) => ({
          payments,
          label,
          reason: "Payment category within this account",
        }));
      else if (merchants.length > 1)
        partitions = merchants.map(([id, payments]) => ({
          payments,
          label: entities.get(id)!.name,
          reason: "Payments to this merchant",
        }));
      else if (devices.length > 1)
        partitions = devices.map(([id, payments]) => ({
          payments,
          label: entities.get(id)!.name,
          reason:
            "Device recorded on these payments; unknown devices indicate missing data",
        }));
      else if (locations.length > 1)
        partitions = locations.map(([id, payments]) => ({
          payments,
          label: entities.get(id)!.name,
          reason:
            "Location recorded on these payments; unknown locations indicate missing data",
        }));
      else {
        const dates = buckets(payments, (p) => p.occurredAt.slice(0, 10));
        if (dates.length > 1)
          partitions = dates.map(([label, payments]) => ({
            payments,
            label,
            reason: "Payments recorded on this UTC calendar date",
          }));
      }
    }
    group.children = partitions.map((part, index) =>
      build(
        part.payments,
        `${id}/${index}`,
        part.label,
        part.reason,
        part.communities,
      ),
    );
    const labels = new Map<string, number>();
    for (const child of group.children)
      labels.set(child.label, (labels.get(child.label) ?? 0) + 1);
    for (const child of group.children)
      if (labels.get(child.label)! > 1)
        child.reference = child.id
          .split("/")
          .slice(1)
          .map((n) => Number(n) + 1)
          .join(".");
    return group;
  }
  return build(
    orderedPayments(scenario.payments),
    "all",
    "All payments",
    "Groups follow shared transaction evidence; sizes and sector counts are determined by the data",
  );
}

export function pathToPayment(
  root: TransactionGroup,
  paymentId: string,
): string[] {
  const child = root.children.find((g) =>
    g.payments.some((p) => p.id === paymentId),
  );
  return child ? [child.id, ...pathToPayment(child, paymentId)] : [];
}

export function sharedEntities(
  a: TransactionGroup,
  b: TransactionGroup,
  entities: Entity[],
): Entity[] {
  return entities.filter(
    (n) =>
      a.entityIds.has(n.id) &&
      b.entityIds.has(n.id) &&
      (n.type === "merchant" ||
        n.type === "account" ||
        (n.type === "device" &&
          a.payments.some(
            (p) =>
              p.deviceId === n.id &&
              !p.unavailableRules?.includes("shared_device_accounts"),
          ) &&
          b.payments.some(
            (p) =>
              p.deviceId === n.id &&
              !p.unavailableRules?.includes("shared_device_accounts"),
          ))),
  );
}

export const groupLabel = (group: TransactionGroup) =>
  group.label + (group.reference ? ` · ${group.reference}` : "");
