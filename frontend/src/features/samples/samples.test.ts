import { describe, expect, it } from "vitest";
import { buildCsvDocument, initialMapping, parseCsv } from "../../domain/csv";
import { csvDefaults } from "../../domain/csv-defaults";
import { MAX_OBJECTS, MAX_PAYMENTS } from "../../domain/limits";
import { catalog, sampleDocument } from "./samples";

const files = import.meta.glob<string>("../../../public/samples/**/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
});
const contentFor = (file: string) => files[`../../../public/samples/${file}`]!;

describe("Curated sample assets", () => {
  for (const sample of catalog.samples) {
    it(`${sample.id} is a complete, labeled, model-compatible import`, async () => {
      const content = contentFor(sample.file);
      const bytes = new TextEncoder().encode(content);
      expect(bytes.byteLength).toBe(sample.bytes);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      expect(hash).toBe(sample.sha256);
      const document = sampleDocument(sample, content);
      const { scenario } = document;
      expect(scenario.payments).toHaveLength(sample.rows);
      expect(scenario.payments.length).toBeLessThanOrEqual(MAX_PAYMENTS);
      expect(scenario.nodes.length).toBeLessThanOrEqual(MAX_OBJECTS);
      expect(
        scenario.nodes.filter((node) => node.type === "account"),
      ).toHaveLength(sample.accounts);
      expect(
        scenario.nodes.filter((node) => node.type === "merchant"),
      ).toHaveLength(sample.merchants);
      expect(Object.values(scenario.groundTruth)).toHaveLength(sample.rows);
      expect(
        Object.values(scenario.groundTruth).filter(
          (value) => value === "fraudulent",
        ),
      ).toHaveLength(sample.fraudCount);
      const table = parseCsv(content);
      const mapping = initialMapping(table.headers);
      mapping.label = "";
      const unlabeled = buildCsvDocument(
        table,
        mapping,
        csvDefaults(sample.title),
      ).document!;
      expect(unlabeled.scenario.groundTruth).toEqual({});
      expect(unlabeled.scenario.payments).toEqual(scenario.payments);
      expect(unlabeled.scenario.nodes).toEqual(scenario.nodes);
    });
  }

  it("rejects incomplete samples before replacing the workspace", () => {
    const sample = catalog.samples[0]!;
    const content = contentFor(sample.file);
    expect(() =>
      sampleDocument(
        sample,
        content.trimEnd().split("\n").slice(0, -1).join("\n"),
      ),
    ).toThrow("incomplete");
  });
});
