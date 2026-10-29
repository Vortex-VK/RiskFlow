import { MAX_CSV_BYTES, MAX_PAYMENTS, MAX_OBJECTS } from "./limits";
import { identifier } from "../api/decode";
import { assertIntegrity, blank } from "./commands";
import { categories, country, parseMoney } from "./types";
import type { Association, Document, Entity, Payment } from "./types";
import { csvMoney, normalizeCsvDate } from "./csv-values";
import type { DateOptions } from "./csv-values";

function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, sort(val)]),
          )
        : v;
  return JSON.stringify(sort(value));
}

export const csvFields = [
  "payment_id",
  "timestamp",
  "amount",
  "account_id",
  "merchant_id",
  "device_id",
  "location_id",
  "account_name",
  "merchant_name",
  "device_name",
  "location_name",
  "account_opened_at",
  "typical_amount",
  "usual_countries",
  "usual_categories",
  "merchant_category",
  "merchant_country",
  "location_country",
  "label",
  "device_observed_at",
  "device_known_from",
  "location_observed_at",
  "location_known_from",
  "currency",
  "debit",
  "credit",
  "time",
  "year",
  "month",
  "day",
  "user",
  "card",
  "card_errors",
  "transaction_type",
  "direction",
  "status",
  "channel",
  "mcc",
  "merchant_state",
  "merchant_city",
  "merchant_zip",
] as const;
type CsvField = (typeof csvFields)[number];
export type ColumnMapping = Record<CsvField, string>;
export type CsvTable = {
  headers: string[];
  rows: { line: number; cells: string[] }[];
};
export type ImportDefaults = DateOptions & {
  name: string;
  openedAt: string;
  typicalAmount: string;
  countries: string;
  categories: string;
  merchantCategory: string;
  merchantCountry: string;
  locationCountry: string;
  amountMode?: "positive" | "negative" | "debit-credit";
  decimal?: "dot" | "comma";
  statementAccount?: string;
  useAssumedBaselines?: boolean;
};
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export function parseCsv(
  input: string,
  limits = { maxRows: MAX_PAYMENTS, maxCharacters: MAX_CSV_BYTES },
): CsvTable {
  if (input.length > limits.maxCharacters)
    throw new Error("CSV exceeds the supported text size.");
  let source = input.replace(/^\uFEFF/, "");
  if (
    [...source].some(
      (char) =>
        (char.charCodeAt(0) < 32 &&
          ![9, 10, 13].includes(char.charCodeAt(0))) ||
        char.charCodeAt(0) === 127 ||
        char === "\ufffd",
    )
  )
    throw new Error(
      "CSV contains corrupted or binary text. Export a fresh text CSV.",
    );
  const directive = source.match(/^sep=([,;\t])\r?\n/i);
  if (directive) source = source.slice(directive[0].length);
  const firstLine = source.split(/\r?\n/, 1)[0]!.replace(/"(?:[^"]|"")*"/g, "");
  const delimiter =
    directive?.[1] ||
    [",", ";", "\t"].sort(
      (a, b) => firstLine.split(b).length - firstLine.split(a).length,
    )[0]!;
  const rows: CsvTable["rows"] = [];
  let cells: string[] = [],
    value = "",
    quoted = false,
    closed = false,
    line = directive ? 2 : 1,
    start = line;
  const cell = () => {
    cells.push(value.trim());
    value = "";
    closed = false;
    if (cells.length > 100)
      throw new Error(`Row ${start}: at most 100 columns are supported.`);
  };
  const row = () => {
    cell();
    if (cells.some(Boolean)) rows.push({ line: start, cells });
    cells = [];
    if (rows.length > limits.maxRows + 1)
      throw new Error(
        `Import supports at most ${limits.maxRows.toLocaleString("en-US")} rows (plus a header).`,
      );
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        value += char;
        if (char === "\n") line++;
      }
      continue;
    }
    if (char === '"') {
      if (value || closed) throw new Error(`Row ${line}: unexpected quote.`);
      quoted = true;
    } else if (char === delimiter) cell();
    else if (char === "\r" || char === "\n") {
      row();
      if (char === "\r" && source[i + 1] === "\n") i++;
      line++;
      start = line;
    } else if (closed && char.trim())
      throw new Error(`Row ${line}: unexpected text after a closing quote.`);
    else if (!closed) value += char;
  }
  if (quoted) throw new Error(`Row ${start}: unclosed quoted field.`);
  if (value || cells.length || closed) row();
  const headers = rows.shift()?.cells;
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw new Error("CSV needs unique, nonempty column headers.");
  if (!rows.length) throw new Error("CSV contains no payment rows.");
  for (const r of rows)
    if (r.cells.length !== headers.length)
      throw new Error(
        `Row ${r.line}: expected ${headers.length} columns, found ${r.cells.length}.`,
      );
  return { headers, rows };
}

export function initialMapping(headers: string[]): ColumnMapping {
  const aliases: Partial<Record<CsvField, string[]>> = {
    timestamp: [
      "occurred_at",
      "occurredat",
      "date",
      "transaction_date",
      "posted_date",
      "created_utc",
      "created",
      "completed_date",
    ],
    payment_id: ["transaction_id", "event_id", "balance_transaction_id", "id"],
    amount: ["amount_usd", "gross", "transaction_amount"],
    account_id: ["customer_id", "account", "account_number"],
    account_name: ["customer_name"],
    merchant_name: ["payee", "merchant", "description", "name"],
    currency: ["currency_code"],
    debit: ["debits", "withdrawal", "withdrawals", "money_out"],
    credit: ["credits", "deposit", "deposits", "money_in"],
    transaction_type: ["reporting_category"],
    label: ["ground_truth", "is_fraud", "isfraud", "is_fraud?"],
    channel: ["use_chip"],
    merchant_zip: ["zip"],
    card_errors: ["errors?"],
  };
  const mapping = Object.fromEntries(
    csvFields.map((field) => [
      field,
      [field, field.replaceAll("_", ""), ...(aliases[field] || [])]
        .map((alias) =>
          headers.find(
            (h) =>
              h
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_") === alias,
          ),
        )
        .find(Boolean) || "",
    ]),
  ) as ColumnMapping;
  if (
    mapping.user &&
    mapping.card &&
    mapping.card_errors &&
    mapping.channel &&
    mapping.mcc
  ) {
    // In card exports, Merchant Name is an identifier, not a display-name fallback.
    mapping.merchant_id ||= mapping.merchant_name;
    if (mapping.merchant_id === mapping.merchant_name)
      mapping.merchant_name = "";
    mapping.label ||=
      headers.find((h) => h.trim().toLowerCase() === "is fraud?") || "";
  }
  return mapping;
}

export function isCardMapping(mapping: ColumnMapping): boolean {
  return [
    "user",
    "card",
    "year",
    "month",
    "day",
    "time",
    "channel",
    "mcc",
    "merchant_id",
    "card_errors",
  ].every((field) => Boolean(mapping[field as CsvField]));
}

export function csvTimestamp(value: string): string {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    )
  )
    throw new Error(
      "Timestamps need an ISO date/time with seconds and Z or a UTC offset.",
    );
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const check = new Date(Date.UTC(year!, month! - 1, day!));
  const hour = Number(value.slice(11, 13)),
    minute = Number(value.slice(14, 16)),
    second = Number(value.slice(17, 19));
  const result = new Date(value);
  if (
    check.getUTCMonth() !== month! - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !Number.isFinite(result.getTime()) ||
    result.getUTCFullYear() < 1900 ||
    result.getUTCFullYear() > 2100
  )
    throw new Error("Invalid calendar timestamp (supported years: 1900–2100).");
  return result.toISOString();
}

function category(value: string) {
  if (!categories.some((c) => c === value))
    throw new Error(`Unsupported merchant category: ${value}.`);
  return value as (typeof categories)[number];
}
function sourceId(value: string) {
  if (!value || value.length > 500)
    throw new Error(
      "Source object IDs or descriptions must contain 1–500 characters.",
    );
  return value;
}

export function buildCsvDocument(
  table: CsvTable,
  mapping: ColumnMapping,
  defaults: ImportDefaults,
  canvas = { width: 1200, height: 800 },
): { document: Document | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings = new Set<string>();
  const cardExport = isCardMapping(mapping);
  if (
    !mapping.timestamp &&
    ![mapping.year, mapping.month, mapping.day].every(Boolean)
  )
    errors.push(
      "Map a timestamp/date column, or all three Year, Month and Day columns.",
    );
  if (cardExport && defaults.amountMode && defaults.amountMode !== "positive")
    errors.push(
      "Card exports use positive purchases; negative amounts are excluded as incoming adjustments. Select Positive purchases only.",
    );
  if (cardExport) {
    warnings.add(
      "Card export: account history is scoped to User + Card. Blank Errors? means completed; other values mean failed attempts. Negative amounts are excluded as incoming adjustments.",
    );
    if (!defaults.timezone)
      warnings.add(
        "This card export has no timezone. Its clock is assumed UTC (Z); set a different UTC offset if needed. Missing seconds stay at :00, and equal-time events do not affect each other's history.",
      );
  }
  for (const field of [
    defaults.amountMode === "debit-credit" ? "debit" : "amount",
  ] as const)
    if (!mapping[field] || !table.headers.includes(mapping[field]))
      errors.push(`Map the required ${field} column.`);
  const mapped = Object.values(mapping).filter(Boolean);
  if (mapped.some((column) => !table.headers.includes(column)))
    errors.push(
      "A mapped column is missing from this file. Review the column mapping.",
    );
  if (new Set(mapped).size !== mapped.length)
    errors.push("Use each source column only once.");
  if (errors.length) return { document: null, errors, warnings: [] };
  try {
    category(defaults.merchantCategory);
  } catch (e) {
    return { document: null, errors: [String(e)], warnings: [] };
  }
  const document = blank();
  document.scenario.name = defaults.name.trim();
  const nodes = new Map<string, Entity>();
  const merchantCategories = new Map<string, Set<string>>();
  const associations = new Map<string, Association>();
  const observations = new Map<string, boolean>();
  const associationRows = new Map<string, number>();
  const ids = new Set<string>();
  let dateOnlyFound = false;
  let excluded = 0;
  const read = (row: CsvTable["rows"][number], field: CsvField) =>
    mapping[field]
      ? row.cells[table.headers.indexOf(mapping[field])] || ""
      : "";
  const entity = (
    type: Entity["type"],
    source: string,
    data: WithoutId<Entity>,
  ) => {
    if (!data.name.trim() || data.name.length > 80)
      throw new Error(
        "Object display names must contain 1–80 characters. Map a shorter name column.",
      );
    const key = `${type}:${sourceId(source)}`;
    const existing = nodes.get(key);
    const node = {
      ...data,
      id: existing?.id || `csv_${type}_${nodes.size + 1}`,
    } as Entity;
    const sameMerchant =
      existing?.type === "merchant" && node.type === "merchant";
    if (
      existing &&
      canonical(
        sameMerchant ? { ...existing, category: node.category } : existing,
      ) !== canonical(node)
    )
      throw new Error(
        `Conflicting metadata for ${type} "${data.name}". Use the same properties in every row.`,
      );
    if (node.type === "merchant") {
      const seen = merchantCategories.get(key) || new Set<string>();
      seen.add(node.category);
      merchantCategories.set(key, seen);
      if (seen.size > 1) node.category = "other";
    }
    nodes.set(key, node);
    return node;
  };
  for (const row of table.rows) {
    try {
      const currency = read(row, "currency").toUpperCase();
      if (currency && currency !== "USD")
        throw new Error(
          `Currency ${currency} is not supported. Import USD transactions separately; no exchange-rate conversion is performed.`,
        );
      if (mapping.currency && !currency)
        throw new Error("Currency is missing in the mapped currency column.");
      if (!mapping.currency)
        warnings.add("No currency column: amounts are assumed to be USD.");
      const type = read(row, "transaction_type").toLowerCase();
      if (mapping.transaction_type && !type)
        throw new Error("Transaction type is missing.");
      if (
        type &&
        ![
          "charge",
          "payment",
          "purchase",
          "bill_payment",
          "authorization",
        ].includes(type)
      ) {
        excluded++;
        continue;
      }
      const direction = read(row, "direction").toLowerCase();
      if (["credit", "incoming", "in"].includes(direction)) {
        excluded++;
        continue;
      }
      if (direction && !["debit", "outgoing", "out"].includes(direction))
        throw new Error(`Unrecognized money direction: ${direction}.`);
      const status =
        cardExport && !mapping.status
          ? read(row, "card_errors")
            ? "failed"
            : "completed"
          : read(row, "status").toLowerCase();
      if (["reversed", "refunded", "cancelled", "canceled"].includes(status)) {
        excluded++;
        continue;
      }
      if (
        status &&
        ![
          "completed",
          "complete",
          "posted",
          "settled",
          "success",
          "succeeded",
          "paid",
          "pending",
          "declined",
          "failed",
        ].includes(status)
      )
        throw new Error(`Unrecognized transaction status: ${status}.`);
      if (["pending", "declined", "failed"].includes(status))
        warnings.add(
          "Pending, declined, and failed payments are included as attempts. Their status is not treated as a fraud label.",
        );
      let amount: number;
      if (defaults.amountMode === "debit-credit") {
        const debit = read(row, "debit"),
          credit = read(row, "credit");
        const out = debit ? csvMoney(debit, defaults.decimal) : 0;
        const incoming = credit ? csvMoney(credit, defaults.decimal) : 0;
        if (out < 0 || incoming < 0 || (out && incoming) || (!out && !incoming))
          throw new Error(
            "Use one positive debit or credit per row, with the other blank or zero.",
          );
        if (incoming) {
          excluded++;
          continue;
        }
        amount = out;
      } else {
        const signed = csvMoney(read(row, "amount"), defaults.decimal);
        if (cardExport && signed < 0) {
          excluded++;
          continue;
        }
        if (signed === 0)
          throw new Error("Payment amount must be greater than zero.");
        if (defaults.amountMode === "negative") {
          if (signed > 0) {
            excluded++;
            continue;
          }
          amount = -signed;
        } else {
          if (signed < 0)
            throw new Error(
              "Negative amount: choose 'Money out is negative' for a bank statement, or remove refunds from a purchases-only file.",
            );
          amount = signed;
        }
      }
      const paymentId =
        read(row, "payment_id") || `CSV_${String(row.line).padStart(3, "0")}`;
      identifier(paymentId);
      if (ids.has(paymentId))
        throw new Error(`Duplicate payment ID ${paymentId}.`);
      ids.add(paymentId);
      if (!read(row, "payment_id"))
        warnings.add(
          "Missing payment IDs are generated from source row numbers.",
        );
      let date = read(row, "timestamp");
      if (!mapping.timestamp) {
        const year = read(row, "year"),
          month = read(row, "month"),
          day = read(row, "day");
        if (
          !/^\d{4}$/.test(year) ||
          !/^\d{1,2}$/.test(month) ||
          !/^\d{1,2}$/.test(day)
        )
          throw new Error(
            "Year, Month and Day must contain numeric calendar components.",
          );
        date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      const parsedDate = normalizeCsvDate(
        date,
        read(row, "time"),
        cardExport && !defaults.timezone
          ? { ...defaults, timezone: "Z" }
          : defaults,
      );
      const time = csvTimestamp(parsedDate.iso);
      dateOnlyFound ||= parsedDate.dateOnly;
      const opened = csvTimestamp(
        read(row, "account_opened_at") || defaults.openedAt,
      );
      if (
        cardExport &&
        ![read(row, "user"), read(row, "card")].every((v) => /^\d+$/.test(v))
      )
        throw new Error(
          "Card exports require numeric User and Card values on every row.",
        );
      const accountId = cardExport
          ? `ibm-user-${read(row, "user")}-card-${read(row, "card")}`
          : read(row, "account_id") || "\u0001statement-account",
        merchantId =
          read(row, "merchant_id") ||
          (read(row, "merchant_name")
            ? `\u0001name:${read(row, "merchant_name")}:${read(row, "merchant_country") || defaults.merchantCountry}`
            : `\u0001unknown-merchant-${row.line}`);
      const unavailable: NonNullable<
        Document["scenario"]["payments"][number]["unavailableRules"]
      > = [];
      if (!cardExport && !read(row, "account_id"))
        warnings.add(
          "Rows without an account ID belong to one statement account. Import different accounts separately or map their IDs.",
        );
      if (!read(row, "merchant_id"))
        warnings.add(
          "Merchants are grouped by exact payee/description text and country. Missing descriptions create separate unknown merchants.",
        );
      if (!defaults.useAssumedBaselines) {
        if (!read(row, "typical_amount")) unavailable.push("unusual_amount");
        if (!read(row, "usual_countries") || !read(row, "location_country"))
          unavailable.push("unusual_location");
        if (!read(row, "usual_categories") || !read(row, "merchant_category"))
          unavailable.push("merchant_category_deviation");
      }
      const account = entity("account", accountId, {
        type: "account",
        name:
          read(row, "account_name") ||
          (cardExport || read(row, "account_id")
            ? accountId
            : defaults.statementAccount || "Statement account"),
        openedAt: opened,
        typicalAmountMinor: parseMoney(
          read(row, "typical_amount") || defaults.typicalAmount,
        ),
        usualCountryCodes: (read(row, "usual_countries") || defaults.countries)
          .split("|")
          .map(country)
          .sort(),
        usualMerchantCategories: (
          read(row, "usual_categories") || defaults.categories
        )
          .split("|")
          .map((v) => category(v.trim()))
          .sort(),
      });
      const sourceCategory = read(row, "merchant_category");
      if (sourceCategory.length > 80)
        throw new Error("Payment category must contain at most 80 characters.");
      const paymentCategory = (() => {
        const source = (
          read(row, "merchant_category") || defaults.merchantCategory
        )
          .trim()
          .toLowerCase();
        const aliases: Record<string, string> = {
          restaurants: "dining",
          restaurant: "dining",
          fuel: "transport",
          transportation: "transport",
          shopping: "retail",
          supermarket: "groceries",
        };
        const normalized =
          aliases[source] ||
          (categories.some((c) => c === source) ? source : "other");
        if (normalized !== source)
          warnings.add(
            `Merchant category "${source}" is mapped to "${normalized}".`,
          );
        return category(normalized);
      })();
      const merchant = entity("merchant", merchantId, {
        type: "merchant",
        name: (
          read(row, "merchant_name") ||
          read(row, "merchant_id") ||
          "Unknown merchant"
        ).slice(0, 80),
        category: paymentCategory,
        countryCode: country(
          read(row, "merchant_country") || defaults.merchantCountry,
        ),
      });
      const deviceId = read(row, "device_id") || `\u0001${account.id}`;
      const locationId = read(row, "location_id") || `\u0001${account.id}`;
      if (!read(row, "device_id"))
        unavailable.push("new_device", "shared_device_accounts");
      if (!read(row, "location_id")) unavailable.push("unusual_location");
      const device = entity("device", deviceId, {
        type: "device",
        name: read(row, "device_id")
          ? read(row, "device_name") || deviceId
          : "Unknown device",
      });
      const location = entity("location", locationId, {
        type: "location",
        name: read(row, "location_id")
          ? read(row, "location_name") || locationId
          : "Unknown location",
        countryCode: country(
          read(row, "location_country") || defaults.locationCountry,
        ),
      });
      if (time < opened) throw new Error("Payment precedes account opening.");
      for (const target of [device, location]) {
        const type = target.type === "device" ? "device" : "location";
        const explicit = !!read(row, `${type}_observed_at`);
        const observed = explicit
          ? csvTimestamp(read(row, `${type}_observed_at`))
          : time;
        const known = read(row, `${type}_known_from`)
          ? csvTimestamp(read(row, `${type}_known_from`))
          : null;
        if (observed < opened || observed > time)
          throw new Error(
            `${type} observation must be between account opening and payment time.`,
          );
        const key = `${account.id}:${target.id}`;
        const existing = associations.get(key);
        if (
          existing &&
          (existing.knownFrom !== known ||
            observations.get(key) !== explicit ||
            (explicit && existing.observedAt !== observed))
        )
          throw new Error(
            `Conflicting ${type} relationship metadata for ${accountId}.`,
          );
        associations.set(key, {
          id: existing?.id || `csv_link_${associations.size + 1}`,
          type: type === "device" ? "accountDevice" : "accountLocation",
          accountId: account.id,
          targetId: target.id,
          observedAt:
            existing && existing.observedAt < observed
              ? existing.observedAt
              : observed,
          knownFrom: known,
        });
        observations.set(key, explicit);
        if (!associationRows.has(key)) associationRows.set(key, row.line);
      }
      const sourceLabel = read(row, "label");
      const fraudColumn = /^is[ _]?fraud\??$/i.test(mapping.label.trim());
      const label =
        (cardExport && /^(yes|no)$/i.test(sourceLabel)) ||
        (fraudColumn && /^(1|0|yes|no|true|false)$/i.test(sourceLabel))
          ? /^(1|yes|true)$/i.test(sourceLabel)
            ? "fraudulent"
            : "legitimate"
          : sourceLabel;
      if (
        label &&
        label !== "unlabeled" &&
        label !== "legitimate" &&
        label !== "fraudulent"
      )
        throw new Error(
          "Label must be legitimate, fraudulent, unlabeled, or empty. Fraud-flag columns also accept 0/1 or true/false.",
        );
      if (label === "legitimate" || label === "fraudulent")
        document.scenario.groundTruth[paymentId] = label;
      document.scenario.payments.push({
        id: paymentId,
        accountId: account.id,
        merchantId: merchant.id,
        deviceId: device.id,
        locationId: location.id,
        occurredAt: time,
        amountMinor: amount,
        category: paymentCategory,
        rankingInput: {
          timePrecision: parsedDate.dateOnly ? "day" : "second",
          activityType: type || "purchase",
          category: read(row, "mcc") || sourceCategory || "",
          channel: read(row, "channel"),
          completed: ["completed", "posted", "settled"].includes(status)
            ? true
            : ["failed", "declined"].includes(status)
              ? false
              : null,
          merchantRegion: read(row, "merchant_state"),
          merchantCity: read(row, "merchant_city"),
          sourcePaymentId: paymentId,
          merchantIdProvided: Boolean(read(row, "merchant_id")),
        },
        modelInput: (() => {
          const channel = read(row, "channel");
          const mcc = (read(row, "mcc") || sourceCategory).match(
            /^(?:MCC\s+)?([0-9]{4})$/,
          )?.[1];
          const supported = [
            "completed",
            "complete",
            "posted",
            "settled",
            "success",
            "succeeded",
            "paid",
            "failed",
            "declined",
          ];
          if (
            !mcc ||
            ![
              "Chip Transaction",
              "Online Transaction",
              "Swipe Transaction",
            ].includes(channel) ||
            !supported.includes(status) ||
            parsedDate.dateOnly
          )
            return null;
          return {
            channel: channel as NonNullable<Payment["modelInput"]>["channel"],
            mcc,
            completed: !["failed", "declined"].includes(status),
            merchantState: read(row, "merchant_state"),
            merchantCity: read(row, "merchant_city"),
            merchantZip: read(row, "merchant_zip"),
          };
        })(),
        ...(sourceCategory ? { sourceCategory } : {}),
        unavailableRules: [...new Set(unavailable)],
      });
    } catch (e) {
      errors.push(
        `Row ${row.line}: ${e instanceof Error ? e.message : "Invalid data."}`,
      );
    }
  }
  if (nodes.size > MAX_OBJECTS)
    errors.unshift(
      `This import contains ${nodes.size.toLocaleString()} objects; the limit is ${MAX_OBJECTS.toLocaleString()}. Objects include accounts, merchants, devices, and location placeholders. Reduce distinct objects or import a smaller set.`,
    );
  for (const [key, seen] of merchantCategories)
    if (seen.size > 1)
      warnings.add(
        `Merchant "${nodes.get(key)!.name}" has multiple payment categories (${[...seen].sort().join(", ")}). It remains one merchant with summary category "other"; each payment retains its own category.`,
      );
  for (const [key, relationship] of associations) {
    if (
      relationship.knownFrom &&
      relationship.knownFrom < relationship.observedAt
    )
      errors.push(
        `Row ${associationRows.get(key)}: familiarity cannot precede the relationship's first observation.`,
      );
  }
  if (excluded)
    warnings.add(
      `${excluded} rows excluded by the selected money-direction or transaction-type filter. Only payments are simulated.`,
    );
  if (!document.scenario.payments.length && !errors.length)
    errors.push(
      "No payments remain after filtering. Check the amount direction and transaction-type mapping.",
    );
  if (dateOnlyFound) {
    warnings.add(
      "Dates without times use midnight UTC for display only. History uses whole-day batches and omits calendar signals when any date-only rows are present.",
    );
    for (const payment of document.scenario.payments)
      payment.unavailableRules = [
        ...new Set([
          ...(payment.unavailableRules || []),
          "payment_velocity",
          "shared_device_accounts",
        ] as const),
      ];
  }
  if (document.scenario.payments.some((p) => !p.modelInput))
    warnings.add(
      "Optional category, channel, completion status or geography may be missing. Ranking retains unknown values; sparse data can reduce performance. Device/location objects are display placeholders.",
    );
  if (errors.length)
    return {
      document: null,
      errors:
        errors.length > 50
          ? [
              ...errors.slice(0, 50),
              `${errors.length - 50} additional errors. Correct the file before importing.`,
            ]
          : errors,
      warnings: [...warnings],
    };
  document.scenario.nodes = [...nodes.values()];
  document.scenario.associations = [...associations.values()];
  document.scenario.scenarioStartAt = document.scenario.payments
    .map((p) => p.occurredAt)
    .sort()[0]!;
  const columns = ["account", "device", "merchant", "location"];
  columns.forEach((type, column) =>
    document.scenario.nodes
      .filter((n) => n.type === type)
      .forEach((node, index) => {
        document.view.positions[node.id] = {
          x: 140 + column * 270,
          y: 160 + index * 140 + [0, -100, 0, 100][column]!,
        };
      }),
  );
  const positions = Object.values(document.view.positions);
  const left = Math.min(...positions.map((p) => p.x)) - 60;
  const right = Math.max(...positions.map((p) => p.x)) + 60;
  const top = Math.min(...positions.map((p) => p.y)) - 60;
  const bottom = Math.max(...positions.map((p) => p.y)) + 60;
  const zoom = Math.max(
    0.25,
    Math.min(
      1,
      (canvas.width - 100) / (right - left),
      (canvas.height - 220) / (bottom - top),
    ),
  );
  document.view.viewport = {
    x: canvas.width / 2 - ((left + right) * zoom) / 2,
    y: canvas.height / 2 - ((top + bottom) * zoom) / 2,
    zoom,
  };
  try {
    assertIntegrity(document);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid graph.");
  }
  return {
    document: errors.length ? null : document,
    errors,
    warnings: [...warnings],
  };
}
