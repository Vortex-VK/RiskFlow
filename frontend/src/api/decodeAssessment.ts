import {
  decodeDocument,
  identifier,
  integer,
  list,
  object,
  text,
  timestamp,
} from "./decode";
import { decodeRun } from "./decodeRun";
import { decodeModel } from "./decodeModel";
import { decodeCardPattern } from "./decodeCardPattern";
import { decodeCardScores } from "./decodeScores";
import { decodeBehavioral } from "./decodeBehavioral";
import { decodeLifecycle } from "./decodeLifecycle";
import { decodeProfiles } from "./decodeProfiles";
import type { components } from "./generated";
import { categories, country } from "../domain/types";

export type AssessmentRun = components["schemas"]["AssessmentRun"];
export type Dataset = components["schemas"]["Dataset"];
export type ImportPreview = components["schemas"]["ImportPreview"];
export type EventPage = components["schemas"]["EventPage"];
export type RunSummary = components["schemas"]["RunSummary"];

function requireValue(condition: boolean, field: string): asserts condition {
  if (!condition)
    throw new Error(`Invalid retained-history ${field}. Reload the dataset.`);
}

function hash(value: unknown) {
  requireValue(
    typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
    "hash",
  );
}

export function decodeDataset(value: unknown): Dataset {
  const data = object(
    value,
    ["id", "name", "sourceNamespace", "revision", "createdAt", "eventCount"],
    "dataset",
  );
  identifier(data.id);
  text(data.name, "dataset name");
  text(data.sourceNamespace, "source namespace", 200);
  integer(data.revision, 0, Number.MAX_SAFE_INTEGER, "revision");
  integer(data.eventCount, 0, 20000, "event count");
  timestamp(data.createdAt);
  return data as Dataset;
}

export function decodePreview(value: unknown): ImportPreview {
  const data = object(
    value,
    [
      "id",
      "datasetId",
      "expectedRevision",
      "sourceHash",
      "filename",
      "mapping",
      "rows",
      "errors",
      "canCommit",
      "committedRevision",
    ],
    "import preview",
  );
  identifier(data.id);
  identifier(data.datasetId);
  integer(data.expectedRevision, 0, Number.MAX_SAFE_INTEGER, "revision");
  hash(data.sourceHash);
  text(data.filename, "filename", 255);
  requireValue(
    !!data.mapping &&
      typeof data.mapping === "object" &&
      !Array.isArray(data.mapping),
    "mapping",
  );
  for (const column of Object.values(data.mapping as object))
    text(column, "column", 1000);
  const errors = list(data.errors, 20000, "import errors");
  errors.forEach((error) => text(error, "import error", 20000));
  const rows = list(data.rows, 20000, "source rows");
  requireValue(rows.length > 0, "empty preview");
  const seen = new Set<number>();
  let blocked = errors.length > 0;
  for (const value of rows) {
    const row = object(
      value,
      [
        "row",
        "sourceEventId",
        "disposition",
        "analyticalStatus",
        "reason",
        "eventId",
        "changes",
      ],
      "source row",
    );
    integer(row.row, 2, 20001, "row number");
    requireValue(!seen.has(row.row), "duplicate row");
    seen.add(row.row);
    requireValue(
      ["added", "duplicate", "conflict", "invalid", "corrected"].includes(
        String(row.disposition),
      ),
      "row disposition",
    );
    requireValue(
      ["eligible", "not_assessed", "invalid"].includes(
        String(row.analyticalStatus),
      ),
      "row status",
    );
    if (row.eventId !== null) identifier(row.eventId);
    if (row.sourceEventId !== null)
      text(row.sourceEventId, "source event ID", 200);
    if (row.reason !== null) text(row.reason, "row reason", 20000);
    for (const raw of list(row.changes ?? [], 100, "field changes")) {
      const change = object(raw, ["field", "before", "after"], "field change");
      text(change.field, "changed field", 200);
      text(change.before, "previous value", 7000000);
      text(change.after, "proposed value", 7000000);
      requireValue(
        change.before !== change.after,
        "unchanged correction field",
      );
    }
    if (row.disposition === "corrected") {
      requireValue(
        Array.isArray(row.changes) && row.changes.length > 0,
        "missing correction changes",
      );
      text(row.reason, "correction reason", 1000);
    }
    requireValue(
      row.reason !== null ||
        (row.analyticalStatus === "eligible" && row.disposition !== "conflict"),
      "missing row reason",
    );
    if (row.disposition === "conflict" || row.disposition === "invalid")
      blocked = true;
    requireValue(
      row.disposition === "invalid"
        ? row.eventId === null && row.analyticalStatus === "invalid"
        : row.eventId !== null,
      "row identity",
    );
  }
  requireValue(data.canCommit === !blocked, "commit eligibility");
  if (data.committedRevision !== null)
    integer(
      data.committedRevision,
      data.expectedRevision,
      data.expectedRevision + 1,
      "committed revision",
    );
  return data as ImportPreview;
}

export function decodeAssessment(value: unknown): AssessmentRun {
  const data = object(
    value,
    [
      "schemaVersion",
      "id",
      "datasetId",
      "revision",
      "recordedAt",
      "mode",
      "knowledgeLimitation",
      "inputHash",
      "analysisHash",
      "adapterVersion",
      "taxonomyVersion",
      "assessmentVersion",
      "document",
      "simulation",
      "assessments",
      "lifecycle",
      "knowledgeCutoff",
      "profiles",
      "analysisMode",
    ],
    "assessment run",
  );
  requireValue(
    data.schemaVersion === 2 &&
      data.taxonomyVersion === "categories-v1" &&
      ((data.adapterVersion === "retained-v1" &&
        data.assessmentVersion === "assessment-v2.1" &&
        data.mode === "retrospective" &&
        data.lifecycle == null &&
        data.knowledgeCutoff == null) ||
        (data.adapterVersion === "retained-v2" &&
          [
            "assessment-v2.2",
            "assessment-v2.3",
            "assessment-v2.4",
            "assessment-v2.5",
            "assessment-v2.6",
            "assessment-v2.7",
            "assessment-v2.8",
            "assessment-v2.9",
            "assessment-v2.10",
            "assessment-behavioral-v1",
          ].includes(String(data.assessmentVersion)) &&
          ["retrospective", "as_known"].includes(String(data.mode)))),
    "version",
  );
  const behavioral = data.assessmentVersion === "assessment-behavioral-v1";
  requireValue(
    behavioral
      ? data.analysisMode === "behavioral"
      : [
            "assessment-v2.6",
            "assessment-v2.7",
            "assessment-v2.8",
            "assessment-v2.9",
            "assessment-v2.10",
          ].includes(String(data.assessmentVersion))
        ? data.analysisMode === "model"
        : data.analysisMode === undefined || data.analysisMode === "v13",
    "analysis mode",
  );
  if (data.mode === "as_known") timestamp(data.knowledgeCutoff);
  else
    requireValue(data.knowledgeCutoff == null, "unexpected knowledge cutoff");
  identifier(data.id);
  identifier(data.datasetId);
  integer(data.revision, 0, Number.MAX_SAFE_INTEGER, "revision");
  timestamp(data.recordedAt);
  text(data.knowledgeLimitation, "knowledge limitation", 2000);
  hash(data.inputHash);
  hash(data.analysisHash);
  const document = decodeDocument(data.document);
  const profiles = ["assessment-v2.3", "assessment-v2.4"].includes(
    String(data.assessmentVersion),
  )
    ? decodeProfiles(data.profiles, document)
    : undefined;
  if (!profiles) requireValue(data.profiles == null, "unexpected profiles");
  if (profiles)
    requireValue(
      profiles.config.version ===
        (data.assessmentVersion === "assessment-v2.4"
          ? "profiles-v2"
          : "profiles-v1"),
      "profile version",
    );
  requireValue(document.scenario.id === data.datasetId, "dataset snapshot");
  const simulation =
    data.simulation === null
      ? null
      : decodeRun(data.simulation, document, profiles);
  requireValue(
    simulation !== null ||
      document.scenario.payments.length === 0 ||
      behavioral,
    "missing simulation",
  );
  if (behavioral) requireValue(simulation === null, "descriptive simulation");
  if (simulation)
    requireValue(
      simulation.runId === data.id &&
        simulation.completedAt === data.recordedAt,
      "simulation identity",
    );
  if (
    simulation &&
    [
      "assessment-v2.5",
      "assessment-v2.6",
      "assessment-v2.7",
      "assessment-v2.8",
      "assessment-v2.9",
    ].includes(String(data.assessmentVersion))
  )
    requireValue(
      simulation.engineVersion ===
        (data.assessmentVersion === "assessment-v2.10"
          ? "engine-ml-stack-d5"
          : data.assessmentVersion === "assessment-v2.9"
            ? "engine-ml-upload-v9"
            : data.assessmentVersion === "assessment-v2.8"
              ? "engine-ml-upload-v8"
              : data.assessmentVersion === "assessment-v2.7"
                ? "engine-ml-upload-v7"
                : data.assessmentVersion === "assessment-v2.6"
                  ? "engine-ml-upload-v5"
                  : "engine-ml-v13"),
      "assessment engine",
    );
  const results = new Map(
    simulation?.events.map((event) => [event.eventId, event]),
  );
  const seen = new Set<string>();
  for (const value of list(data.assessments, 20000, "assessments")) {
    const item = object(
      value,
      [
        "eventId",
        "sourceEventId",
        "score",
        "coverage",
        "evaluatedRules",
        "totalRules",
        "recommendation",
        "reason",
        "signals",
        "model",
        "cardPattern",
        "cardScores",
        "behavioral",
      ],
      "assessment",
    );
    identifier(item.eventId);
    text(item.sourceEventId, "source event ID", 200);
    requireValue(!seen.has(item.eventId), "duplicate assessment");
    seen.add(item.eventId);
    const result = results.get(item.eventId);
    const suggestion = decodeCardPattern(item.cardPattern);
    const cardScores = decodeCardScores(item.cardScores);
    requireValue(
      JSON.stringify(cardScores) === JSON.stringify(result?.cardScores ?? null),
      "card score result",
    );
    requireValue(
      JSON.stringify(suggestion) ===
        JSON.stringify(result?.cardPattern ?? null),
      "card-pattern result",
    );
    if (behavioral) {
      requireValue(
        item.score === null &&
          item.model == null &&
          item.evaluatedRules === 0 &&
          item.totalRules === 0 &&
          item.recommendation === "not_assessed" &&
          list(item.signals, 6, "signals").length === 0,
        "descriptive result",
      );
      text(item.reason, "behavioral reason", 2000);
      const evidence =
        item.behavioral == null ? null : decodeBehavioral(item.behavioral);
      requireValue(
        item.coverage === (evidence ? "partial" : "not_assessed"),
        "behavioral coverage",
      );
      continue;
    }
    requireValue(item.behavioral == null, "unexpected behavioral result");
    if (
      [
        "assessment-v2.5",
        "assessment-v2.6",
        "assessment-v2.7",
        "assessment-v2.8",
        "assessment-v2.9",
        "assessment-v2.10",
      ].includes(String(data.assessmentVersion))
    ) {
      requireValue(
        item.evaluatedRules === 0 &&
          item.totalRules === 0 &&
          item.score === null &&
          list(item.signals, 6, "signals").length === 0,
        "model coverage",
      );
      requireValue(
        item.coverage === (result ? "partial" : "not_assessed"),
        "coverage status",
      );
      requireValue(
        item.recommendation ===
          (result
            ? result.decision === "review"
              ? "review"
              : "no_alert"
            : "not_assessed"),
        "model recommendation",
      );
      text(item.reason, "coverage reason", 2000);
      if (result)
        requireValue(
          JSON.stringify(decodeModel(item.model)) ===
            JSON.stringify(result.model),
          "model result",
        );
      else requireValue(item.model == null, "unsupported model result");
      continue;
    }
    const rules = result?.ruleEvaluations ?? [];
    const count = rules.filter((rule) => rule.available !== false).length;
    requireValue(
      item.evaluatedRules === count && item.totalRules === 6,
      "rule coverage",
    );
    requireValue(item.score === (count ? result!.riskScore : null), "score");
    requireValue(
      item.coverage ===
        (count === 6 ? "complete" : count ? "partial" : "not_assessed"),
      "coverage status",
    );
    const expected = !count
      ? "not_assessed"
      : result!.decision === "block"
        ? "high_priority"
        : result!.decision === "review"
          ? "review"
          : "no_alert";
    requireValue(item.recommendation === expected, "recommendation");
    if (item.reason !== null) text(item.reason, "assessment reason", 2000);
    requireValue(
      count === 6 || item.reason !== null,
      "missing coverage reason",
    );
    const signals = list(item.signals, 6, "signals");
    requireValue(signals.length === rules.length, "signal count");
    signals.forEach((value, index) => {
      const signal = object(value, ["ruleId", "available", "reason"], "signal");
      const rule = rules[index]!;
      requireValue(
        signal.ruleId === rule.ruleId &&
          signal.available === (rule.available !== false),
        "signal availability",
      );
      if (signal.available)
        requireValue(signal.reason === null, "available signal reason");
      else text(signal.reason, "unavailable signal reason", 2000);
    });
  }
  for (const eventId of results.keys())
    requireValue(seen.has(eventId), "missing assessment");
  if (data.adapterVersion === "retained-v2") {
    const lifecycle = decodeLifecycle(data.lifecycle, seen);
    const sourceIds = new Map(
      (data.assessments as AssessmentRun["assessments"]).map((item) => [
        item.eventId,
        item.sourceEventId,
      ]),
    );
    for (const item of lifecycle.entries) {
      requireValue(
        !results.has(item.eventId) || item.attempt,
        "non-attempt scored",
      );
      requireValue(
        sourceIds.get(item.eventId) === item.sourceEventId,
        "lifecycle source identity",
      );
    }
    if (behavioral) {
      const records = new Map(
        lifecycle.entries.map((entry) => [entry.eventId, entry]),
      );
      const observations = new Map(
        (data.assessments as AssessmentRun["assessments"]).map((entry) => [
          entry.eventId,
          entry.behavioral,
        ]),
      );
      for (const item of data.assessments as AssessmentRun["assessments"]) {
        const own = records.get(item.eventId);
        for (const id of item.behavioral?.evidenceIds ?? []) {
          const prior = records.get(id);
          const evidence = observations.get(id);
          requireValue(
            id !== item.eventId &&
              prior !== undefined &&
              own !== undefined &&
              prior.accountId === own.accountId &&
              prior.currency === own.currency,
            "behavioral evidence scope",
          );
          requireValue(
            evidence != null &&
              item.behavioral != null &&
              evidence.occurredAt < item.behavioral.occurredAt &&
              (evidence.timePrecision !== "date" ||
                Date.parse(evidence.occurredAt) + 86400000 <=
                  Date.parse(item.behavioral.occurredAt)),
            "future behavioral evidence",
          );
        }
      }
    }
    if (profiles) {
      const records = new Map(
        lifecycle.entries.map((entry) => [entry.eventId, entry]),
      );
      const payments = new Map(
        document.scenario.payments.map((payment) => [payment.id, payment]),
      );
      for (const profile of profiles.events) {
        const record = records.get(profile.eventId);
        requireValue(
          record?.accountId === profile.accountId &&
            record.currency === profile.currency,
          "profile account",
        );
        for (const signal of profile.signals) {
          for (const id of [
            ...signal.evidenceIds,
            ...(signal.merchantRange?.evidenceIds ?? []),
          ]) {
            const evidence = records.get(id);
            requireValue(
              evidence?.accountId === profile.accountId &&
                evidence.currency === profile.currency,
              "profile evidence scope",
            );
            const payment = payments.get(id);
            requireValue(
              !payment || payment.occurredAt < signal.evaluatedAt,
              "future profile evidence",
            );
          }
          if (signal.merchantRange) {
            const current = payments.get(profile.eventId);
            for (const id of signal.merchantRange.evidenceIds) {
              const prior = payments.get(id);
              requireValue(
                !prior || prior.merchantId === current?.merchantId,
                "merchant evidence identity",
              );
            }
          }
          if (signal.trustEventId) {
            const assertion = records.get(signal.trustEventId);
            requireValue(
              assertion?.accountId === profile.accountId &&
                assertion.currency === profile.currency,
              "trust assertion scope",
            );
          }
        }
      }
    }
  }
  return { ...data, document, simulation } as AssessmentRun;
}

export function decodeRunSummary(value: unknown): RunSummary {
  const data = object(
    value,
    ["id", "revision", "recordedAt", "eventCount", "analysisHash"],
    "run summary",
  );
  identifier(data.id);
  integer(data.revision, 0, Number.MAX_SAFE_INTEGER, "revision");
  integer(data.eventCount, 0, 20000, "event count");
  timestamp(data.recordedAt);
  hash(data.analysisHash);
  return data as RunSummary;
}

export function decodeEventPage(value: unknown, versions = false): EventPage {
  const data = object(
    value,
    ["items", "total", "offset", "limit"],
    "event page",
  );
  integer(data.total, 0, versions ? Number.MAX_SAFE_INTEGER : 20000, "total");
  integer(data.offset, 0, Number.MAX_SAFE_INTEGER, "offset");
  integer(data.limit, 1, 200, "limit");
  const items = list(data.items, data.limit, "retained events");
  requireValue(
    items.length ===
      Math.min(data.limit, Math.max(0, data.total - data.offset)),
    "page count",
  );
  const seen = new Set<string>();
  for (const value of items) {
    const item = object(
      value,
      [
        "event",
        "acceptedRevision",
        "recordedAt",
        "importId",
        "sourceRow",
        "analyticalStatus",
        "reason",
        "correctionReason",
      ],
      "retained event",
    );
    integer(
      item.acceptedRevision,
      1,
      Number.MAX_SAFE_INTEGER,
      "accepted revision",
    );
    timestamp(item.recordedAt);
    identifier(item.importId);
    integer(item.sourceRow, 2, 20001, "source row");
    requireValue(
      ["eligible", "not_assessed"].includes(String(item.analyticalStatus)),
      "analytical status",
    );
    if (item.reason !== null) text(item.reason, "reason", 2000);
    if (item.correctionReason != null)
      text(item.correctionReason, "correction reason", 1000);
    requireValue(
      item.analyticalStatus === "eligible"
        ? item.reason === null
        : item.reason !== null,
      "activity reason",
    );
    const event = object(
      item.event,
      [
        "id",
        "sourceEventId",
        "sourceNamespace",
        "accountId",
        "occurredAt",
        "timePrecision",
        "sourceAvailableAt",
        "underlyingTransactionId",
        "lifecycleKind",
        "relatedEventId",
        "amountMinor",
        "currency",
        "direction",
        "activityType",
        "status",
        "merchantId",
        "merchantName",
        "merchantCountry",
        "category",
        "sourceCategory",
        "deviceId",
        "locationId",
        "locationCountry",
        "deviceKnownFrom",
        "deviceTrustState",
        "deviceTrustEffectiveAt",
        "deviceTrustProvenance",
        "locationKnownFrom",
        "typicalAmountMinor",
        "usualCountries",
        "usualCategories",
        "context",
        "sourceFields",
      ],
      "financial event",
    );
    identifier(event.id);
    const key = versions ? `${event.id}:${item.acceptedRevision}` : event.id;
    requireValue(!seen.has(key), "duplicate retained event");
    seen.add(key);
    requireValue(
      [
        "unspecified",
        "authorization",
        "capture",
        "refund",
        "reversal",
        "status_update",
      ].includes(String(event.lifecycleKind ?? "unspecified")),
      "lifecycle kind",
    );
    if (event.relatedEventId != null)
      text(event.relatedEventId, "related event", 200);
    for (const key of ["sourceEventId", "sourceNamespace", "accountId"])
      text(event[key], key, 200);
    timestamp(event.occurredAt);
    integer(event.amountMinor, -100000000, 100000000, "amount");
    requireValue(
      typeof event.currency === "string" && /^[A-Z]{3}$/.test(event.currency),
      "currency",
    );
    requireValue(
      ["instant", "date"].includes(String(event.timePrecision)),
      "time precision",
    );
    for (const key of ["activityType", "status", "direction"])
      requireValue(typeof event[key] === "string", key);
    for (const key of [
      "sourceAvailableAt",
      "deviceKnownFrom",
      "locationKnownFrom",
    ])
      if (event[key] !== null) timestamp(event[key]);
    requireValue(
      ["unknown", "trusted", "revoked"].includes(
        String(event.deviceTrustState ?? "unknown"),
      ),
      "device trust state",
    );
    if (event.deviceTrustState && event.deviceTrustState !== "unknown") {
      text(event.deviceId, "trusted device", 200);
      timestamp(event.deviceTrustEffectiveAt);
      text(event.deviceTrustProvenance, "trust provenance", 200);
    } else
      requireValue(
        event.deviceTrustEffectiveAt == null &&
          event.deviceTrustProvenance == null,
        "unexpected trust assertion",
      );
    for (const key of [
      "merchantId",
      "merchantName",
      "merchantCountry",
      "category",
      "sourceCategory",
      "deviceId",
      "locationId",
      "locationCountry",
      "underlyingTransactionId",
    ])
      if (event[key] !== null) text(event[key], key, 200);
    if (event.typicalAmountMinor !== null)
      integer(event.typicalAmountMinor, 1, 100000000, "typical amount");
    for (const key of ["usualCountries", "usualCategories"])
      list(event[key], 249, key).forEach((value) => text(value, key));
    const countries = event.usualCountries as string[];
    const categoryValues = event.usualCategories as string[];
    requireValue(
      new Set(countries).size === countries.length &&
        countries.every((value) => country(value) === value),
      "usual countries",
    );
    requireValue(
      categoryValues.length <= 8 &&
        new Set(categoryValues).size === categoryValues.length &&
        categoryValues.every((value) =>
          categories.includes(value as (typeof categories)[number]),
        ),
      "usual categories",
    );
    for (const key of ["merchantCountry", "locationCountry"])
      if (event[key] !== null)
        requireValue(country(event[key] as string) === event[key], key);
    if (event.category !== null)
      requireValue(
        categories.includes(event.category as (typeof categories)[number]),
        "category",
      );
    requireValue(
      !!event.sourceFields &&
        typeof event.sourceFields === "object" &&
        !Array.isArray(event.sourceFields),
      "source fields",
    );
    for (const value of Object.values(event.sourceFields as object))
      requireValue(typeof value === "string", "source value");
    requireValue(
      !!event.context &&
        typeof event.context === "object" &&
        !Array.isArray(event.context),
      "context",
    );
    for (const value of Object.values(event.context as object))
      requireValue(typeof value === "string", "context value");
  }
  return data as EventPage;
}
