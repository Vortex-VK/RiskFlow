import { expect, it } from "vitest";
import { buildCsvDocument, initialMapping, parseCsv } from "./csv";
import type { ImportDefaults } from "./csv";
import source from "../../../fixtures/evaluations/card-format-10000/unlabeled.csv?raw";

const defaults: ImportDefaults = {
  name: "Card import",
  openedAt: "1900-01-01T00:00:00.000Z",
  typicalAmount: "50",
  countries: "US",
  categories: "retail",
  merchantCategory: "other",
  merchantCountry: "US",
  locationCountry: "US",
};
const build = (text: string, options = defaults) => {
  const table = parseCsv(text);
  return buildCsvDocument(table, initialMapping(table.headers), options);
};
const header =
  "User,Card,Year,Month,Day,Time,Amount,Use Chip,Merchant Name,Merchant City,Merchant State,Zip,MCC,Errors?";
const row =
  "1,0,2018,1,2,08:04,$37.66,Chip Transaction,-123,Boston,MA,02108,5912,";

it("imports the complete 10,000-row card export with instrument-scoped history and no labels", () => {
  const result = build(source);
  expect(result.errors).toEqual([]);
  const scenario = result.document!.scenario;
  expect(scenario.payments).toHaveLength(10000);
  expect(new Set(scenario.payments.map((p) => p.accountId)).size).toBe(136);
  expect(scenario.groundTruth).toEqual({});
  expect(scenario.payments.every((p) => p.modelInput)).toBe(true);
  expect(
    scenario.payments.filter((p) => !p.modelInput!.completed),
  ).toHaveLength(80);
  expect(scenario.payments[0]).toMatchObject({
    occurredAt: "2018-01-01T08:04:00.000Z",
    amountMinor: 3766,
    modelInput: {
      channel: "Chip Transaction",
      mcc: "5912",
      merchantZip: "02108",
    },
  });
  expect(result.warnings.join()).toContain("assumed UTC");
  expect(result.warnings.join()).not.toContain("one statement account");
});

it("combines split dates without silently assuming a timezone outside card format", () => {
  const csv = "Year,Month,Day,Time,Amount\n2024,2,29,08:04,10";
  expect(build(csv).errors.join()).toContain("timezone");
  const result = build(csv, { ...defaults, timezone: "-05:00" });
  expect(result.errors).toEqual([]);
  expect(result.document!.scenario.payments[0]!.occurredAt).toBe(
    "2024-02-29T13:04:00.000Z",
  );
  expect(
    build(csv.replace("2024", "2023"), {
      ...defaults,
      timezone: "Z",
    }).errors.join(),
  ).toContain("Invalid calendar");
  expect(
    build(csv.replace("Year,Month,Day", "Year,Month,Other")).errors.join(),
  ).toContain("all three");
});

it("preserves card identity, leading-zero ZIP, explicit timezone and known failed attempts", () => {
  const result = build(
    `${header}\n${row}\n${row.replace("1,0,", "1,1,").replace("08:04", "08:05")}Bad PIN`,
    { ...defaults, timezone: "-05:00" },
  );
  expect(result.errors).toEqual([]);
  const [first, second] = result.document!.scenario.payments;
  expect(first!.accountId).not.toBe(second!.accountId);
  expect(first!.occurredAt).toBe("2018-01-02T13:04:00.000Z");
  expect(second!.modelInput!.completed).toBe(false);
  expect(first!.modelInput!.merchantZip).toBe("02108");
});

it("keeps optional card labels separate from predictors and excludes refunds", () => {
  const positive = build(`${header},Is Fraud?\n${row},Yes`);
  const negative = build(`${header},Is Fraud?\n${row},No`);
  expect(positive.errors).toEqual([]);
  expect(positive.document!.scenario.payments).toEqual(
    negative.document!.scenario.payments,
  );
  expect(Object.values(positive.document!.scenario.groundTruth)).toEqual([
    "fraudulent",
  ]);
  expect(Object.values(negative.document!.scenario.groundTruth)).toEqual([
    "legitimate",
  ]);
  const refund = build(
    `${header}\n${row}\n${row.replace("$37.66", "$-10.00")}`,
  );
  expect(refund.errors).toEqual([]);
  expect(refund.document!.scenario.payments).toHaveLength(1);
  expect(refund.warnings.join()).toContain("1 rows excluded");
  expect(
    build(`${header}\n${row.replace("1,0,", ",0,")}`).errors.join(),
  ).toContain("User and Card");
});
