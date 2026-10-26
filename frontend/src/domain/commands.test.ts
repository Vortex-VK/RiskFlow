import { beforeEach, describe, expect, it } from "vitest";
import hero from "../../../fixtures/scenarios/shared-device-cluster.json";
import { decodeDocument } from "../api/decode";
import { useWorkspace } from "../state/workspace";
import {
  addNode,
  assertIntegrity,
  blank,
  clone,
  deletion,
  newNode,
  paymentDefault,
  starterContext,
} from "./commands";
import { parseMoney, utc } from "./types";
import { MAX_OBJECTS } from "./limits";

const fixture = () => clone(decodeDocument(hero));

describe("wire values and edit commands", () => {
  it.each(["", "-1", "1e3", "1,000", "1.001", "0", "1000000.01", "Infinity"])(
    "rejects invalid money %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("parses cents exactly at both boundaries", () => {
    expect(parseMoney("0.01")).toBe(1);
    expect(parseMoney("1000000")).toBe(100000000);
    expect(parseMoney("12.3")).toBe(1230);
  });
  it.each([
    "2026-02-29T12:00",
    "2026-04-31T12:00",
    "1899-12-31T23:00",
    "2101-01-01T00:00",
  ])("rejects invalid date %s", (value) => expect(() => utc(value)).toThrow());
  it("preserves milliseconds and canonical UTC", () =>
    expect(utc("2024-02-29T12:34:56.123")).toBe("2024-02-29T12:34:56.123Z"));
  it("rejects unknown countries, reserved IDs, nonfinite coordinates, and dangling view positions", () => {
    const country = clone(hero);
    country.scenario.nodes[0]!.usualCountryCodes = ["ZZ"];
    expect(() => decodeDocument(country)).toThrow();
    const reserved = clone(hero);
    reserved.scenario.nodes[0]!.id = "constructor";
    expect(() => decodeDocument(reserved)).toThrow();
    const nonfinite = fixture();
    nonfinite.view.positions["account-a"]!.x = Infinity;
    expect(() => decodeDocument(nonfinite)).toThrow();
    const extra = fixture();
    extra.view.positions.extra = { x: 0, y: 0 };
    expect(() => decodeDocument(extra)).toThrow();
  });
  it("builds a real blank scenario, reuses partial context, and adds only one history-worthy insertion", () => {
    const empty = blank(new Date("2024-02-29T20:00:00.000Z"));
    const account = newNode("account", empty.scenario.scenarioStartAt);
    expect(account.type === "account" && account.openedAt).toBe(
      "2023-02-28T00:00:00.000Z",
    );
    let document = addNode(empty, account, { x: 300, y: 200 });
    const device = newNode("device", document.scenario.scenarioStartAt);
    document = addNode(document, device, { x: 400, y: 200 });
    document.scenario.associations.push({
      id: "existing",
      type: "accountDevice",
      accountId: account.id,
      targetId: device.id,
      observedAt: "2024-02-28T00:00:00.000Z",
      knownFrom: null,
    });
    const next = starterContext(document, account.id);
    expect(next.scenario.nodes).toHaveLength(3);
    expect(next.scenario.associations).toHaveLength(2);
    expect(next.scenario.associations[0]!.id).toBe("existing");
    expect(document.scenario.nodes).toHaveLength(2);
    expect(() => starterContext(next, account.id)).toThrow("already");
    const merchant = newNode("merchant", next.scenario.scenarioStartAt);
    const complete = addNode(next, merchant, { x: 600, y: 200 });
    complete.scenario.payments.push(
      paymentDefault(complete, account.id, merchant.id),
    );
    expect(assertIntegrity(complete)).toBe(complete);
  });
  it("fails an oversized starter insertion atomically", () => {
    const document = blank(new Date("2026-01-01"));
    const account = newNode("account", document.scenario.scenarioStartAt);
    let full = addNode(document, account, { x: 0, y: 0 });
    for (let index = 0; index < MAX_OBJECTS - 2; index++)
      full = addNode(full, newNode("merchant", full.scenario.scenarioStartAt), {
        x: index * 130,
        y: 200,
      });
    const before = JSON.stringify(full);
    expect(() => starterContext(full, account.id)).toThrow();
    expect(JSON.stringify(full)).toBe(before);
  });
  it("accepts observation at payment time but rejects future context", () => {
    const document = fixture();
    const payment = document.scenario.payments[0]!;
    const a = document.scenario.associations.find(
      (a) =>
        a.accountId === payment.accountId && a.targetId === payment.deviceId,
    )!;
    a.observedAt = payment.occurredAt;
    a.knownFrom = null;
    expect(() => assertIntegrity(document)).not.toThrow();
    a.observedAt = new Date(
      new Date(payment.occurredAt).getTime() + 1,
    ).toISOString();
    expect(() => assertIntegrity(document)).toThrow("observed");
  });
  it("keeps identical payment endpoints and times as separate events", () => {
    const document = fixture();
    const original = document.scenario.payments[0]!;
    document.scenario.payments.push({ ...original, id: "another-payment" });
    assertIntegrity(document);
    const removed = deletion(document, { kind: "payment", id: original.id });
    expect(
      removed.document.scenario.payments.some(
        (p) => p.id === "another-payment",
      ),
    ).toBe(true);
    expect(removed.document.scenario.groundTruth[original.id]).toBeUndefined();
  });
  it("cascades context deletion without retargeting payments, with labels and view cleaned together", () => {
    const original = fixture();
    const selection = { kind: "node" as const, id: "device-shared" };
    const affected = original.scenario.payments.filter(
      (p) => p.deviceId === selection.id,
    );
    const result = deletion(original, selection);
    expect(result.paymentCount).toBe(affected.length);
    expect(
      result.document.scenario.associations.some(
        (a) => a.targetId === selection.id,
      ),
    ).toBe(false);
    expect(result.document.view.positions[selection.id]).toBeUndefined();
    for (const p of affected)
      expect(result.document.scenario.groundTruth[p.id]).toBeUndefined();
    expect(original.scenario.payments).toHaveLength(16);
    const relationship = original.scenario.associations.find(
      (a) => a.targetId === selection.id,
    )!;
    const deleted = deletion(original, {
      kind: "association",
      id: relationship.id,
    });
    expect(
      deleted.document.scenario.nodes.some((n) => n.id === selection.id),
    ).toBe(true);
    expect(
      deleted.document.scenario.payments.every(
        (p) =>
          p.accountId !== relationship.accountId || p.deviceId !== selection.id,
      ),
    ).toBe(true);
  });
});

describe("bounded document history", () => {
  beforeEach(() => useWorkspace.getState().replace(fixture()));
  const rename = (name: string) => {
    const next = clone(useWorkspace.getState().document!);
    next.scenario.nodes[0]!.name = name;
    useWorkspace.getState().commit(next, "Renamed");
  };
  it("restores facts, labels, positions and repairs selection atomically", () => {
    const before = clone(useWorkspace.getState().document!);
    useWorkspace.getState().select({ kind: "node", id: "device-shared" });
    useWorkspace
      .getState()
      .commit(
        deletion(before, { kind: "node", id: "device-shared" }).document,
        "Deleted",
      );
    expect(useWorkspace.getState().selection).toBeNull();
    useWorkspace.getState().undo();
    expect(useWorkspace.getState().document).toEqual(before);
    useWorkspace.getState().redo();
    expect(
      useWorkspace.getState().document!.scenario.payments.length,
    ).toBeLessThan(16);
  });
  it("retains only twenty entries and clears redo after a new edit", () => {
    for (let index = 0; index < 25; index++) rename(`Account ${index}`);
    expect(useWorkspace.getState().past).toHaveLength(20);
    for (let index = 0; index < 21; index++) useWorkspace.getState().undo();
    expect(useWorkspace.getState().document!.scenario.nodes[0]!.name).toBe(
      "Account 4",
    );
    rename("Branch");
    expect(useWorkspace.getState().future).toHaveLength(0);
  });
  it("preserves current viewport and blocks history during unapplied edits", () => {
    rename("Changed");
    const state = useWorkspace.getState();
    const current = clone(state.document!);
    current.view.viewport = { x: 123, y: 456, zoom: 0.5 };
    useWorkspace.setState({ document: current, dirty: true });
    state.undo();
    expect(useWorkspace.getState().past).toHaveLength(1);
    useWorkspace.setState({ dirty: false });
    state.undo();
    expect(useWorkspace.getState().document!.view.viewport).toEqual(
      current.view.viewport,
    );
  });
  it("rejects an invalid command without changing document or history", () => {
    const original = useWorkspace.getState().document!;
    const invalid = clone(original);
    invalid.scenario.payments[0]!.deviceId = "missing";
    expect(() => useWorkspace.getState().commit(invalid, "Bad")).toThrow();
    expect(useWorkspace.getState().document).toBe(original);
    expect(useWorkspace.getState().past).toHaveLength(0);
  });
});
