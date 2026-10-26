import { describe, expect, it } from "vitest";
import {
  buildCsvDocument,
  csvTimestamp,
  initialMapping,
  parseCsv,
} from "./csv";
import type { ImportDefaults } from "./csv";
import { MAX_RETAINED_IMPORT_BYTES, MAX_RETAINED_IMPORT_ROWS } from "./limits";
import smallStatement from "../../../fixtures/imports/riskflow_transactions_s3_285.csv?raw";
import largeStatement from "../../../fixtures/imports/riskflow_transactions_l_9000.csv?raw";

const header =
  "payment_id,timestamp,amount,account_id,merchant_id,device_id,location_id";
const first = "P1,2026-10-20T09:00:00Z,12.34,A,Shop,Phone,Home";
const second = "P2,2026-10-20T09:01:00Z,50.00,B,Shop,Phone,Home";
const defaults: ImportDefaults = {
  name: "Imported",
  openedAt: "2020-01-01T00:00:00Z",
  typicalAmount: "50.00",
  countries: "US",
  categories: "groceries|retail",
  merchantCategory: "retail",
  merchantCountry: "US",
  locationCountry: "US",
};
const build = (text: string, assumptions = defaults) => {
  const table = parseCsv(text);
  return buildCsvDocument(table, initialMapping(table.headers), assumptions);
};

it("keeps retained source-row limits separate from sandbox payments", () => {
  const limits = {
    maxRows: MAX_RETAINED_IMPORT_ROWS,
    maxCharacters: MAX_RETAINED_IMPORT_BYTES,
  };
  const source = `id\n${Array.from({ length: 20_000 }, (_, i) => i).join("\n")}`;
  expect(parseCsv(source, limits).rows).toHaveLength(20_000);
  expect(() => parseCsv(`${source}\n20000`, limits)).toThrow("20,000 rows");
  expect(() => parseCsv(source)).toThrow("10,000 rows");
});

it("allows retained text up to its byte ceiling without widening the sandbox", () => {
  const limits = {
    maxRows: MAX_RETAINED_IMPORT_ROWS,
    maxCharacters: MAX_RETAINED_IMPORT_BYTES,
  };
  const source = `id\n${"x".repeat(MAX_RETAINED_IMPORT_BYTES - 3)}`;
  expect(parseCsv(source, limits).rows).toHaveLength(1);
  expect(() => parseCsv(`${source}x`, limits)).toThrow("text size");
  expect(() => parseCsv(source)).toThrow("text size");
});

it.each([
  ["small", smallStatement, 232, 116, 53],
  ["large", largeStatement, 7612, 681, 1388],
] as const)(
  "imports the %s statement without splitting mixed-category merchants",
  (_name, source, payments, objects, excluded) => {
    const result = build(source, {
      ...defaults,
      openedAt: "1900-01-01T00:00:00Z",
    });
    expect(result.errors).toEqual([]);
    const scenario = result.document!.scenario;
    expect(scenario.payments).toHaveLength(payments);
    expect(scenario.nodes).toHaveLength(objects);
    expect(result.warnings.join()).toContain(`${excluded} rows excluded`);
    const walmart = scenario.nodes.filter(
      (node) => node.type === "merchant" && node.name === "Walmart",
    );
    expect(walmart).toHaveLength(1);
    expect(walmart[0]).toMatchObject({ category: "other" });
    const purchases = scenario.payments.filter(
      (payment) => payment.merchantId === walmart[0]!.id,
    );
    expect(new Set(purchases.map((payment) => payment.category))).toEqual(
      new Set(["retail", "groceries"]),
    );
    expect(
      purchases.every((payment) => payment.category === payment.sourceCategory),
    ).toBe(true);
    expect(scenario.groundTruth).toEqual({});
  },
);

it("preserves payment categories independently of row order and merchant IDs", () => {
  for (const merchantColumn of ["merchant_id", "merchant_name"]) {
    const rows = [
      "P1,2026-10-20T09:00:00Z,12,A,Walmart,retail",
      "P2,2026-10-20T09:01:00Z,15,A,Walmart,groceries",
    ];
    for (const ordered of [rows, [...rows].reverse()]) {
      const result = build(
        `payment_id,timestamp,amount,account_id,${merchantColumn},merchant_category\n${ordered.join("\n")}`,
      );
      expect(result.errors).toEqual([]);
      expect(
        result.document!.scenario.nodes.filter(
          (node) => node.type === "merchant",
        ),
      ).toEqual([
        expect.objectContaining({ name: "Walmart", category: "other" }),
      ]);
      expect(
        Object.fromEntries(
          result.document!.scenario.payments.map((payment) => [
            payment.id,
            payment.category,
          ]),
        ),
      ).toEqual({ P1: "retail", P2: "groceries" });
      expect(result.warnings.join()).toContain(
        'Merchant "Walmart" has multiple payment categories',
      );
    }
  }
});

it("still rejects conflicting merchant identity metadata with readable errors", () => {
  const result = build(
    `${header},merchant_name\n${first},First shop\n${second},Another shop`,
  );
  expect(result.document).toBeNull();
  expect(result.errors.join()).toContain(
    'Conflicting metadata for merchant "Another shop"',
  );
  expect(result.errors.join()).not.toContain("\u0001");
});

describe("CSV input and automatic graph construction", () => {
  it("resolves inferred observation before validating familiarity even when rows are out of order", () => {
    const late = first.replace("09:00", "09:01");
    const early = first.replace("P1", "P2");
    const result = build(
      `${header},device_known_from\n${late},2026-10-20T09:00:30Z\n${early},2026-10-20T09:00:30Z`,
    );
    expect(result.errors).toEqual([]);
    expect(
      result.document!.scenario.associations.find(
        (a) => a.type === "accountDevice",
      ),
    ).toMatchObject({
      observedAt: "2026-10-20T09:00:00.000Z",
      knownFrom: "2026-10-20T09:00:30.000Z",
    });
  });
  it("handles BOM, CRLF, escaped quotes, commas and multiline quoted names with physical row numbers", () => {
    const table = parseCsv(
      '\uFEFFid,name\r\nP1,"Shop, ""North""\nBranch"\r\nP2,Other\r\n',
    );
    expect(table.headers).toEqual(["id", "name"]);
    expect(table.rows).toEqual([
      { line: 2, cells: ["P1", 'Shop, "North"\nBranch'] },
      { line: 4, cells: ["P2", "Other"] },
    ]);
  });
  it.each([
    "a,a\n1,2",
    "a,b\n1",
    'a,b\n"bad,2',
    'a,b\n"bad"text,2',
    'a,b\nhello"bad,2',
    "a,b\n",
  ])("rejects malformed CSV: %s", (input) =>
    expect(() => parseCsv(input)).toThrow(),
  );
  it("builds shared objects and per-account context with integer cents and no inferred labels", () => {
    const result = build(`${header}\n${first}\n${second}`);
    expect(result.errors).toEqual([]);
    const s = result.document!.scenario;
    expect(s.nodes).toHaveLength(5);
    expect(s.associations).toHaveLength(4);
    expect(s.groundTruth).toEqual({});
    expect(s.payments.map((p) => p.amountMinor)).toEqual([1234, 5000]);
    expect(s.payments[0]!.deviceId).toBe(s.payments[1]!.deviceId);
    expect(s.associations.every((a) => a.knownFrom === null)).toBe(true);
    expect(Object.keys(result.document!.view.positions)).toHaveLength(5);
    expect(
      new Set(
        Object.values(result.document!.view.positions).map(
          (p) => `${p.x},${p.y}`,
        ),
      ).size,
    ).toBe(5);
  });
  it("uses earliest observation for repeated pairs, distinct IDs for same-name categories, and explicit truth only", () => {
    const result = build(
      `${header},label\n${first.replace(",Shop,Phone,Home", ",A,A,A")},legitimate\n${first.replace("P1", "P2").replace("09:00", "08:00").replace(",Shop,Phone,Home", ",A,A,A")},`,
    );
    expect(result.errors).toEqual([]);
    expect(result.document!.scenario.nodes).toHaveLength(4);
    expect(
      result.document!.scenario.associations.every(
        (a) => a.observedAt === "2026-10-20T08:00:00.000Z",
      ),
    ).toBe(true);
    expect(result.document!.scenario.groundTruth).toEqual({ P1: "legitimate" });
  });
  it.each([
    first.replace("12.34", "1e3"),
    first.replace("12.34", "0"),
    first.replace("2026-10-20", "2026-02-30"),
    first.replace("09:00:00Z", "09:00:00"),
    first.replace("2026-10-20", "2019-10-20"),
    first.replace("P1", "__proto__"),
  ])(
    "reports invalid data by source row and provides no partial candidate: %s",
    (row) => {
      const result = build(`${header}\n${row}\n${second}`);
      expect(result.document).toBeNull();
      expect(result.errors[0]).toMatch(/^Row 2:/);
    },
  );
  it("rejects duplicate payments and inconsistent node/context metadata", () => {
    expect(build(`${header}\n${first}\n${first}`).errors.join()).toContain(
      "Duplicate payment",
    );
    expect(
      build(
        `${header},merchant_country\n${first},US\n${second},GB`,
      ).errors.join(),
    ).toContain("Conflicting metadata");
    expect(
      build(
        `${header},device_known_from\n${first},2019-01-01T00:00:00Z`,
      ).errors.join(),
    ).toContain("familiarity");
    expect(build(`${header},label\n${first},true`).errors.join()).toContain(
      "Label must",
    );
  });
  it("bounds file, row and graph sizes without modifying the source table", () => {
    expect(() => parseCsv("x".repeat(5_000_001))).toThrow("text size");
    expect(() =>
      parseCsv(
        `${header}\n${Array.from({ length: 10001 }, (_, i) => first.replace("P1", `P${i}`)).join("\n")}`,
      ),
    ).toThrow("10,000 rows");
    const table = parseCsv(
      `${header}\n${Array.from({ length: 251 }, (_, i) => `P${i},2026-10-20T09:00:00Z,1,A${i},M${i},D${i},L${i}`).join("\n")}`,
    );
    const original = structuredClone(table);
    const result = buildCsvDocument(
      table,
      initialMapping(table.headers),
      defaults,
    );
    expect(result.document).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("1,004 objects; the limit is 1,000");
    expect(table).toEqual(original);
  });
  it("supports column mapping and UTC offsets while rejecting invalid assumptions", () => {
    const table = parseCsv(
      `transaction_id,date,amount_usd,account_id,merchant_id,device_id,location_id\n${first}`,
    );
    expect(
      buildCsvDocument(table, initialMapping(table.headers), defaults).errors,
    ).toEqual([]);
    expect(csvTimestamp("2026-10-20T10:30:00+01:30")).toBe(
      "2026-10-20T09:00:00.000Z",
    );
    expect(
      build(`${header}\n${first}`, { ...defaults, merchantCategory: "bad" })
        .document,
    ).toBeNull();
    expect(
      build(`${header}\n${first}`, { ...defaults, countries: "XX" }).document,
    ).toBeNull();
  });
});

it("imports a signed bank statement without inventing timestamps or context evidence", () => {
  const result = build(
    'Date,Description,Amount,Currency\n10/20/2026,Corner Shop,"($1,234.56)",USD\n10/21/2026,Salary,2000,USD',
    { ...defaults, dateOrder: "mdy", amountMode: "negative" },
  );
  expect(result.errors).toEqual([]);
  expect(result.document!.scenario.payments).toHaveLength(1);
  expect(result.document!.scenario.payments[0]).toMatchObject({
    amountMinor: 123456,
    occurredAt: "2026-10-20T00:00:00.000Z",
  });
  expect(result.document!.scenario.payments[0]!.unavailableRules).toHaveLength(
    6,
  );
  expect(result.warnings.join()).toContain("1 rows excluded");
  expect(
    result.document!.scenario.nodes.find((n) => n.type === "device")!.name,
  ).toBe("Unknown device");
});

it("imports debit/credit columns, semicolon decimals and explicit day-first dates", () => {
  const result = build(
    "Date;Payee;Debit;Credit\n20/10/2026;Shop;1.234,56;\n21/10/2026;Salary;;2.000,00",
    {
      ...defaults,
      dateOrder: "dmy",
      amountMode: "debit-credit",
      decimal: "comma",
    },
  );
  expect(result.errors).toEqual([]);
  expect(result.document!.scenario.payments.map((p) => p.amountMinor)).toEqual([
    123456,
  ]);
  expect(
    build("Date,Payee,Debit,Credit\n2026-10-20,Shop,10,5", {
      ...defaults,
      amountMode: "debit-credit",
    }).errors.join(),
  ).toContain("one positive debit or credit");
});

it("maps processor exports to gross purchases and explicitly excludes other transaction types", () => {
  const result = build(
    "balance_transaction_id,created_utc,gross,fee,net,currency,reporting_category,description,customer_id\ntxn_1,2026-10-20 09:00:00,120,4,116,usd,charge,Shop,cus_1\ntxn_2,2026-10-20 09:01:00,-20,0,-20,usd,refund,Shop,cus_1",
    { ...defaults, timezone: "Z" },
  );
  expect(result.errors).toEqual([]);
  expect(result.document!.scenario.payments).toHaveLength(1);
  expect(result.document!.scenario.payments[0]!.amountMinor).toBe(12000);
  expect(result.warnings.join()).toContain("1 rows excluded");
});

it("never guesses ambiguous dates, missing currency, malformed amounts or timezone", () => {
  for (const [csv, message] of [
    ["Date,Amount\n10/11/2026,12", "Choose month/day/year"],
    ["Date,Amount\n2026-10-20 09:00:00,12", "timezone"],
    ["Date,Amount,Currency\n2026-10-20,12,EUR", "not supported"],
    ["Date,Amount,Currency\n2026-10-20,12,", "Currency is missing"],
    ['Date,Amount\n2026-10-20,"1,23.45"', "Invalid amount"],
    ["Date,Amount\n2026-10-20,=1+2", "Invalid amount"],
    ["Date,Amount\n2026-02-30,12", "Invalid calendar"],
    ["Date,Amount\n,12", "Timestamps need"],
  ]) {
    const result = build(csv!);
    expect(result.document).toBeNull();
    expect(result.errors.join()).toContain(message);
  }
});

it("keeps unknown devices separate across accounts and honors explicit baseline opt-in", () => {
  const result = build(
    "Date,Amount,account_id\n2026-10-20,500,A\n2026-10-20,500,B",
    { ...defaults, useAssumedBaselines: true },
  );
  expect(result.errors).toEqual([]);
  expect(
    new Set(result.document!.scenario.payments.map((p) => p.deviceId)).size,
  ).toBe(2);
  expect(result.document!.scenario.payments[0]!.unavailableRules).not.toContain(
    "unusual_amount",
  );
  expect(result.document!.scenario.payments[0]!.unavailableRules).toContain(
    "new_device",
  );
});

it("recognizes tab and Excel separator headers and rejects duplicate or binary headers", () => {
  expect(parseCsv("sep=;\r\nDate;Amount\r\n2026-10-20;12").rows[0]!.line).toBe(
    3,
  );
  expect(parseCsv("Date\tAmount\n2026-10-20\t12").headers).toEqual([
    "Date",
    "Amount",
  ]);
  expect(() => parseCsv("Date,date\n1,2")).toThrow("unique");
  expect(() => parseCsv("Date,Amount\n2026-10-20,\u000012")).toThrow(
    "corrupted",
  );
});
