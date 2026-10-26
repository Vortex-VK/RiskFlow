import { decodeDocument } from "../api/decode";
import type {
  Association,
  Document,
  Entity,
  Payment,
  Position,
  Selection,
} from "./types";
import { groupId } from "./types";

export const id = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);

export function blank(now = new Date()): Document {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return {
    scenario: {
      schemaVersion: 1,
      id: id(),
      name: "Untitled scenario",
      scenarioStartAt: start.toISOString(),
      currency: "USD",
      nodes: [],
      associations: [],
      payments: [],
      groundTruth: {},
      ruleSetVersion: "rules-v1",
      policy: { version: 1, reviewThreshold: 40, blockThreshold: 70 },
      costAssumptions: {
        approvedFraudLossBps: 10000,
        reviewCostMinor: 300,
        falseBlockCostMinor: 1500,
      },
      seed: null,
    },
    view: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

export function assertIntegrity(document: Document): Document {
  decodeDocument(document);
  const s = document.scenario;
  const nodes = new Map(s.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const associations = new Map(
    s.associations.map((a) => [`${a.type}:${a.accountId}:${a.targetId}`, a]),
  );
  const paymentIds = new Set(s.payments.map((p) => p.id));
  for (const a of s.associations) {
    const account = nodes.get(a.accountId);
    if (
      account?.type !== "account" ||
      nodes.get(a.targetId)?.type !==
        (a.type === "accountDevice" ? "device" : "location")
    )
      throw new Error("Choose an account and matching context object.");
    const key = `${a.type}:${a.accountId}:${a.targetId}`;
    if (seen.has(key)) throw new Error("This relationship already exists.");
    seen.add(key);
    if (a.observedAt < account.openedAt)
      throw new Error("Observation cannot be before the account opened.");
    if (a.knownFrom !== null && a.knownFrom < a.observedAt)
      throw new Error("Familiarity cannot start before observation.");
  }
  for (const p of s.payments) {
    const account = nodes.get(p.accountId);
    if (
      account?.type !== "account" ||
      nodes.get(p.merchantId)?.type !== "merchant"
    )
      throw new Error("Choose an account and a merchant.");
    if (p.occurredAt < s.scenarioStartAt || p.occurredAt < account.openedAt)
      throw new Error(
        "Payment time cannot precede scenario start or account opening.",
      );
    for (const [target, type] of [
      [p.deviceId, "accountDevice"],
      [p.locationId, "accountLocation"],
    ]) {
      const a = associations.get(`${type}:${p.accountId}:${target}`);
      if (!a || a.observedAt > p.occurredAt)
        throw new Error(
          "Connect this account to the selected device and location, observed by payment time.",
        );
    }
  }
  if (Object.keys(s.groundTruth).some((key) => !paymentIds.has(key)))
    throw new Error("Labels must belong to existing payments.");
  if (s.policy.reviewThreshold >= s.policy.blockThreshold)
    throw new Error("Review threshold must be lower than block threshold.");
  return document;
}

function freePosition(document: Document, near: Position): Position {
  const offsets = [
    [0, 0],
    [140, 0],
    [0, 140],
    [-140, 0],
    [0, -140],
    [140, 140],
    [-140, -140],
  ];
  for (let ring = 1; ring <= 5; ring++)
    for (const [dx = 0, dy = 0] of offsets) {
      const p = { x: near.x + dx * ring, y: near.y + dy * ring };
      if (
        Object.values(document.view.positions).every(
          (other) =>
            Math.abs(other.x - p.x) > 110 || Math.abs(other.y - p.y) > 95,
        )
      )
        return p;
    }
  return { ...near };
}

export function newNode(type: Entity["type"], start: string): Entity {
  const base = { id: id(), name: `New ${type}`, type };
  if (type === "account") {
    const date = new Date(start);
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
    return {
      ...base,
      type,
      openedAt: date.toISOString(),
      typicalAmountMinor: 5000,
      usualCountryCodes: ["US"],
      usualMerchantCategories: ["groceries", "retail", "dining"],
    };
  }
  if (type === "merchant")
    return { ...base, type, category: "retail", countryCode: "US" };
  if (type === "location") return { ...base, type, countryCode: "US" };
  return { ...base, type };
}

export function addNode(
  document: Document,
  node: Entity,
  near: Position,
  placement: "near" | "exact" = "near",
): Document {
  const next = clone(document);
  next.scenario.nodes.push(node);
  next.view.positions[node.id] =
    placement === "exact" ? { ...near } : freePosition(document, near);
  return assertIntegrity(next);
}

export function contextFor(
  document: Document,
  accountId: string,
  type: Association["type"],
) {
  return document.scenario.associations.filter(
    (a) => a.accountId === accountId && a.type === type,
  );
}

export function starterContext(
  document: Document,
  accountId: string,
): Document {
  const next = clone(document);
  const account = next.scenario.nodes.find((n) => n.id === accountId);
  if (account?.type !== "account") throw new Error("Select an account first.");
  if (
    contextFor(next, accountId, "accountDevice").length &&
    contextFor(next, accountId, "accountLocation").length
  )
    throw new Error("This account already has a device and location.");
  const origin = next.view.positions[accountId]!;
  const before = new Date(
    new Date(next.scenario.scenarioStartAt).getTime() - 86400000,
  ).toISOString();
  const observedAt = before > account.openedAt ? before : account.openedAt;
  for (const type of ["device", "location"] as const) {
    const associationType =
      type === "device" ? "accountDevice" : "accountLocation";
    if (contextFor(next, accountId, associationType).length) continue;
    const node = newNode(type, next.scenario.scenarioStartAt);
    node.name = `${account.name.slice(0, 55)} ${type === "device" ? "phone" : "home"}`;
    next.scenario.nodes.push(node);
    next.view.positions[node.id] = freePosition(next, {
      x: origin.x + 140,
      y: origin.y + (type === "device" ? -80 : 100),
    });
    next.scenario.associations.push({
      id: id(),
      type: associationType,
      accountId,
      targetId: node.id,
      observedAt,
      knownFrom: observedAt,
    });
  }
  return assertIntegrity(next);
}

export function paymentDefault(
  document: Document,
  accountId: string,
  merchantId: string,
): Payment {
  const account = document.scenario.nodes.find((n) => n.id === accountId);
  const device = contextFor(document, accountId, "accountDevice")[0];
  const location = contextFor(document, accountId, "accountLocation")[0];
  const start =
    document.scenario.scenarioStartAt.slice(0, 10) + "T09:00:00.000Z";
  return {
    id: id(),
    accountId,
    merchantId,
    deviceId: device?.targetId || "",
    locationId: location?.targetId || "",
    amountMinor: 5000,
    occurredAt: [
      start,
      document.scenario.scenarioStartAt,
      account?.type === "account" ? account.openedAt : start,
      device?.observedAt || start,
      location?.observedAt || start,
    ]
      .sort()
      .at(-1)!,
  };
}

export function affectedPayments(
  document: Document,
  selection: NonNullable<Selection>,
): Payment[] {
  const { payments, associations, nodes } = document.scenario;
  if (selection.kind === "payment")
    return payments.filter((p) => p.id === selection.id);
  if (selection.kind === "group")
    return payments.filter(
      (p) => groupId(p.accountId, p.merchantId) === selection.id,
    );
  if (selection.kind === "association") {
    const a = associations.find((a) => a.id === selection.id);
    return a
      ? payments.filter(
          (p) =>
            p.accountId === a.accountId &&
            (a.type === "accountDevice" ? p.deviceId : p.locationId) ===
              a.targetId,
        )
      : [];
  }
  const node = nodes.find((n) => n.id === selection.id);
  return node
    ? payments.filter(
        (p) =>
          ({
            account: p.accountId,
            merchant: p.merchantId,
            device: p.deviceId,
            location: p.locationId,
          })[node.type] === node.id,
      )
    : [];
}

export function deletion(
  document: Document,
  selection: NonNullable<Selection>,
) {
  const next = clone(document);
  const payments = affectedPayments(document, selection);
  const ids = new Set(payments.map((p) => p.id));
  const relationships = next.scenario.associations.filter((a) =>
    selection.kind === "node"
      ? a.accountId === selection.id || a.targetId === selection.id
      : selection.kind === "association" && a.id === selection.id,
  );
  next.scenario.payments = next.scenario.payments.filter((p) => !ids.has(p.id));
  const relationshipIds = new Set(relationships.map((a) => a.id));
  next.scenario.associations = next.scenario.associations.filter(
    (a) => !relationshipIds.has(a.id),
  );
  for (const payment of payments) delete next.scenario.groundTruth[payment.id];
  if (selection.kind === "node") {
    next.scenario.nodes = next.scenario.nodes.filter(
      (n) => n.id !== selection.id,
    );
    delete next.view.positions[selection.id];
  }
  return {
    document: assertIntegrity(next),
    paymentCount: payments.length,
    relationshipCount: relationships.length,
  };
}
