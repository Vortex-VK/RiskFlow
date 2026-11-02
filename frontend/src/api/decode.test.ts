import { describe, expect, it } from "vitest";
import hero from "../../../fixtures/scenarios/shared-device-cluster.json";
import everyday from "../../../fixtures/scenarios/everyday-purchases.json";
import stolen from "../../../fixtures/scenarios/stolen-card-burst.json";
import takeover from "../../../fixtures/scenarios/account-takeover.json";
import { decodeDocument, decodeTemplates } from "./decode";
import { assertIntegrity } from "../domain/commands";

describe("API boundary decoders", () => {
  it.each([hero, everyday, stolen, takeover])(
    "accepts a canonical serialized template",
    (fixture) => {
      const document = decodeDocument(JSON.parse(JSON.stringify(fixture)));
      expect(assertIntegrity(document)).toEqual(fixture);
    },
  );
  it("rejects unsupported versions, omitted nullable fields, and invalid strict numbers", () => {
    const missing = JSON.parse(JSON.stringify(hero));
    delete missing.scenario.seed;
    expect(() => decodeDocument(missing)).toThrow();
    missing.scenario.seed = null;
    delete missing.scenario.associations[0].knownFrom;
    expect(() => decodeDocument(missing)).toThrow();
    const boolean = JSON.parse(JSON.stringify(hero));
    boolean.scenario.payments[0].amountMinor = true;
    expect(() => decodeDocument(boolean)).toThrow();
    const version = JSON.parse(JSON.stringify(hero));
    version.scenario.schemaVersion = 2;
    expect(() => decodeDocument(version)).toThrow();
  });
  it("rejects a malformed template catalog", () => {
    expect(() =>
      decodeTemplates([
        {
          id: "hero",
          version: 1,
          title: "Hero",
          narrative: "Story",
          nodeCount: "15",
          paymentCount: 16,
        },
      ]),
    ).toThrow();
  });
});
