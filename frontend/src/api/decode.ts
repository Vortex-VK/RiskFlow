import { MAX_PAYMENTS, MAX_OBJECTS, MAX_ASSOCIATIONS } from "../domain/limits";
import type { components } from "./generated";
import type { Document } from "../domain/types";
import { categories, country, utc } from "../domain/types";

function fail(field: string): never {
  throw new Error(`Invalid ${field}. Check the scenario fields and try again.`);
}
export function object(
  value: unknown,
  allowed: string[],
  field: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    fail(field);
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  field: string,
  max = 80,
): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(field);
}
export function identifier(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value) ||
    ["__proto__", "prototype", "constructor"].includes(value)
  )
    fail("identifier");
}
export function integer(
  value: unknown,
  min: number,
  max: number,
  field: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    fail(field);
}
export function timestamp(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
    utc(value) !== value
  )
    fail("UTC timestamp");
}
export function list(value: unknown, max: number, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(field);
  return value;
}
function note(value: unknown, field: string, max = 500) {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || value.length > max)
  )
    fail(field);
}
function coordinate(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) >= 1000000
  )
    fail("position");
}
function countryCode(value: unknown) {
  if (typeof value !== "string" || country(value) !== value) fail("country");
}

export function decodeDocument(value: unknown): Document {
  const document = object(value, ["scenario", "view"], "document");
  const s = object(
    document.scenario,
    [
      "schemaVersion",
      "id",
      "name",
      "description",
      "sourceTemplateId",
      "sourceTemplateVersion",
      "scenarioStartAt",
      "currency",
      "nodes",
      "associations",
      "payments",
      "groundTruth",
      "ruleSetVersion",
      "policy",
      "costAssumptions",
      "seed",
    ],
    "scenario",
  );
  if (
    s.schemaVersion !== 1 ||
    s.ruleSetVersion !== "rules-v1" ||
    s.currency !== "USD" ||
    s.seed !== null
  )
    fail("scenario version, currency, or seed");
  identifier(s.id);
  text(s.name, "scenario name");
  timestamp(s.scenarioStartAt);
  note(s.description, "description");
  if (s.sourceTemplateId !== undefined && s.sourceTemplateId !== null)
    identifier(s.sourceTemplateId);
  if (s.sourceTemplateVersion !== undefined && s.sourceTemplateVersion !== null)
    integer(
      s.sourceTemplateVersion,
      1,
      Number.MAX_SAFE_INTEGER,
      "template version",
    );
  const ids = new Set<string>(),
    nodeIds = new Set<string>();
  const unique = (value: unknown) => {
    identifier(value);
    if (ids.has(value)) fail("duplicate identifier");
    ids.add(value);
  };
  for (const raw of list(
    s.nodes,
    MAX_OBJECTS,
    `objects (maximum ${MAX_OBJECTS})`,
  )) {
    const base = object(
      raw,
      [
        "id",
        "name",
        "type",
        "openedAt",
        "typicalAmountMinor",
        "usualCountryCodes",
        "usualMerchantCategories",
        "category",
        "countryCode",
        "description",
        "regionLabel",
      ],
      "object",
    );
    unique(base.id);
    nodeIds.add(base.id as string);
    text(base.name, "object name");
    const common = ["id", "type", "name"];
    if (base.type === "account") {
      object(
        raw,
        [
          ...common,
          "openedAt",
          "typicalAmountMinor",
          "usualCountryCodes",
          "usualMerchantCategories",
        ],
        "account",
      );
      timestamp(base.openedAt);
      integer(base.typicalAmountMinor, 1, 100000000, "typical purchase");
      const countries = list(base.usualCountryCodes, 249, "usual countries");
      const usualCategories = list(
        base.usualMerchantCategories,
        8,
        "usual categories",
      );
      if (
        !countries.length ||
        new Set(countries).size !== countries.length ||
        !usualCategories.length ||
        new Set(usualCategories).size !== usualCategories.length
      )
        fail("empty or duplicate baseline choices");
      countries.forEach(countryCode);
      for (const category of usualCategories)
        if (!categories.some((c) => c === category)) fail("usual category");
    } else if (base.type === "merchant") {
      object(raw, [...common, "category", "countryCode"], "merchant");
      countryCode(base.countryCode);
      if (!categories.some((c) => c === base.category)) fail("category");
    } else if (base.type === "device") {
      object(raw, [...common, "description"], "device");
      note(base.description, "description");
    } else if (base.type === "location") {
      object(raw, [...common, "countryCode", "regionLabel"], "location");
      countryCode(base.countryCode);
      if (base.regionLabel !== undefined && base.regionLabel !== null)
        text(base.regionLabel, "region label");
    } else fail("object category");
  }
  for (const raw of list(
    s.associations,
    MAX_ASSOCIATIONS,
    "relationships (maximum 20,000)",
  )) {
    const a = object(
      raw,
      ["id", "type", "accountId", "targetId", "observedAt", "knownFrom"],
      "relationship",
    );
    unique(a.id);
    identifier(a.accountId);
    identifier(a.targetId);
    timestamp(a.observedAt);
    if (a.knownFrom !== null) timestamp(a.knownFrom);
    if (a.type !== "accountDevice" && a.type !== "accountLocation")
      fail("relationship type");
  }
  const paymentIds = new Set<string>();
  for (const raw of list(
    s.payments,
    MAX_PAYMENTS,
    `payments (maximum ${MAX_PAYMENTS.toLocaleString("en-US")})`,
  )) {
    const p = object(
      raw,
      [
        "id",
        "accountId",
        "merchantId",
        "deviceId",
        "locationId",
        "occurredAt",
        "amountMinor",
        "category",
        "sourceCategory",
        "unavailableRules",
        "modelInput",
        "rankingInput",
      ],
      "payment",
    );
    unique(p.id);
    paymentIds.add(p.id as string);
    for (const key of ["accountId", "merchantId", "deviceId", "locationId"])
      identifier(p[key]);
    timestamp(p.occurredAt);
    integer(p.amountMinor, 1, 100000000, "payment amount");
    if (
      p.category != null &&
      !categories.some((category) => category === p.category)
    )
      fail("payment category");
    if (p.sourceCategory != null) text(p.sourceCategory, "source category");
    if (p.rankingInput != null) {
      const input = object(
        p.rankingInput,
        [
          "activityType",
          "timePrecision",
          "category",
          "channel",
          "completed",
          "merchantRegion",
          "merchantCity",
          "sourcePaymentId",
          "merchantIdProvided",
        ],
        "ranking input",
      );
      if (
        !["day", "second"].includes(String(input.timePrecision)) ||
        (input.completed !== null && typeof input.completed !== "boolean") ||
        typeof input.merchantIdProvided !== "boolean"
      )
        fail("ranking input");
      for (const key of [
        "category",
        "channel",
        "merchantRegion",
        "merchantCity",
      ])
        if (typeof input[key] !== "string" || input[key].length > 160)
          fail("ranking input");
      text(input.activityType, "activity type", 40);
      text(input.sourcePaymentId, "source payment ID", 512);
    }
    if (p.modelInput != null) {
      const input = object(
        p.modelInput,
        [
          "channel",
          "mcc",
          "completed",
          "merchantState",
          "merchantCity",
          "merchantZip",
        ],
        "model input",
      );
      if (
        ![
          "Chip Transaction",
          "Online Transaction",
          "Swipe Transaction",
        ].includes(String(input.channel)) ||
        typeof input.mcc !== "string" ||
        !/^[0-9]{4}$/.test(input.mcc) ||
        typeof input.completed !== "boolean"
      )
        fail("model input");
      for (const key of ["merchantState", "merchantCity", "merchantZip"]) {
        if (
          input[key] !== undefined &&
          (typeof input[key] !== "string" ||
            input[key].length > (key === "merchantZip" ? 20 : 80))
        )
          fail("merchant geography");
      }
    }
    if (p.unavailableRules !== undefined) {
      const unavailable = list(p.unavailableRules, 6, "unavailable rules");
      const supported = [
        "unusual_amount",
        "payment_velocity",
        "new_device",
        "unusual_location",
        "merchant_category_deviation",
        "shared_device_accounts",
      ];
      if (
        new Set(unavailable).size !== unavailable.length ||
        unavailable.some((r) => typeof r !== "string" || !supported.includes(r))
      )
        fail("unavailable rules");
    }
  }
  const labels = object(s.groundTruth, [...paymentIds], "synthetic labels");
  for (const label of Object.values(labels))
    if (label !== "legitimate" && label !== "fraudulent")
      fail("synthetic label");
  const policy = object(
    s.policy,
    ["version", "reviewThreshold", "blockThreshold"],
    "policy",
  );
  if (policy.version !== 1) fail("policy version");
  integer(policy.reviewThreshold, 1, 100, "review threshold");
  integer(policy.blockThreshold, 1, 100, "block threshold");
  const costs = object(
    s.costAssumptions,
    ["approvedFraudLossBps", "reviewCostMinor", "falseBlockCostMinor"],
    "cost assumptions",
  );
  integer(costs.approvedFraudLossBps, 0, 10000, "loss basis points");
  integer(costs.reviewCostMinor, 0, 100000000, "review cost");
  integer(costs.falseBlockCostMinor, 0, 100000000, "false block cost");
  const view = object(document.view, ["positions", "viewport"], "view");
  const positions = object(view.positions, [...nodeIds], "object positions");
  if (Object.keys(positions).length !== nodeIds.size)
    fail("missing object positions");
  for (const raw of Object.values(positions)) {
    const p = object(raw, ["x", "y"], "position");
    coordinate(p.x);
    coordinate(p.y);
  }
  const viewport = object(view.viewport, ["x", "y", "zoom"], "viewport");
  coordinate(viewport.x);
  coordinate(viewport.y);
  if (
    typeof viewport.zoom !== "number" ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom < 0.25 ||
    viewport.zoom > 2
  )
    fail("zoom");
  return value as Document;
}

export function decodeTemplates(
  value: unknown,
): components["schemas"]["TemplateSummary"][] {
  for (const item of list(value, 100, "template catalog")) {
    const t = object(
      item,
      ["id", "version", "title", "narrative", "nodeCount", "paymentCount"],
      "template",
    );
    identifier(t.id);
    integer(t.version, 1, Number.MAX_SAFE_INTEGER, "template version");
    text(t.title, "template title");
    if (typeof t.narrative !== "string") fail("template narrative");
    integer(t.nodeCount, 0, MAX_OBJECTS, "object count");
    integer(t.paymentCount, 0, MAX_PAYMENTS, "payment count");
  }
  return value as components["schemas"]["TemplateSummary"][];
}
