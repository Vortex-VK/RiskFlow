import {
  MAX_PAYMENTS,
  MAX_OBJECTS,
  MAX_ASSOCIATIONS,
  MAX_EVIDENCE_EVENTS,
} from "../domain/limits";
import type { Document } from "../domain/types";
import { orderedPayments } from "../domain/types";
import { normalizedScenario } from "../domain/runs";
import type { Run } from "../domain/runs";
import { assertIntegrity } from "../domain/commands";
import type { ProfileReport } from "./decodeProfiles";
import { decodeModel } from "./decodeModel";
import { decodeCardPattern } from "./decodeCardPattern";
import { decodeCardScores } from "./decodeScores";
import {
  decodeDocument,
  identifier,
  integer,
  list,
  object,
  text,
  timestamp,
} from "./decode";

const ruleIds = [
  "unusual_amount",
  "payment_velocity",
  "new_device",
  "unusual_location",
  "merchant_category_deviation",
  "shared_device_accounts",
] as const;
const decisions = ["approve", "review", "block"] as const;
const totalMoney = (value: unknown) =>
  integer(value, 0, 3_000_000_000_000, "result amount");
const fail = (): never => {
  throw new Error(
    "The simulation response is inconsistent. Your draft and previous results are unchanged.",
  );
};

function countAmount(value: unknown) {
  const pair = object(value, ["count", "amountMinor"], "count/amount");
  integer(pair.count, 0, MAX_PAYMENTS, "count");
  totalMoney(pair.amountMinor);
}
function rate(value: unknown) {
  if (value === null) return;
  const r = object(value, ["numerator", "denominator"], "rate");
  integer(r.numerator, 0, MAX_PAYMENTS, "numerator");
  integer(r.denominator, 1, MAX_PAYMENTS, "denominator");
  if (r.numerator > r.denominator) fail();
}

export function decodeRun(
  value: unknown,
  submitted: Document,
  profiles?: ProfileReport,
): Run {
  const run = object(
    value,
    [
      "runId",
      "completedAt",
      "engineVersion",
      "ruleSetVersion",
      "schemaVersion",
      "scenarioSnapshot",
      "events",
      "metrics",
      "warnings",
    ],
    "run",
  );
  identifier(run.runId);
  timestamp(run.completedAt);
  const sequence = run.engineVersion === "engine-ml-upload-v5";
  const coverage = run.engineVersion === "engine-ml-upload-v7";
  const precision = run.engineVersion === "engine-ml-upload-v8";
  const adapted = run.engineVersion === "engine-ml-upload-v9";
  const learned =
    adapted ||
    precision ||
    coverage ||
    sequence ||
    run.engineVersion === "engine-ml-v13";
  if (
    (!learned &&
      run.engineVersion !==
        (profiles?.config.version === "profiles-v2"
          ? "engine-v3"
          : profiles
            ? "engine-v2"
            : "engine-v1")) ||
    run.ruleSetVersion !==
      (adapted
        ? "upload-v9-mixed-source"
        : precision
          ? "upload-v8-precision95"
          : coverage
            ? "upload-v7-balanced"
            : sequence
              ? "upload-v5-recall85"
              : learned
                ? "v13-depth6"
                : "rules-v1") ||
    run.schemaVersion !== 1
  )
    fail();
  const snapshot = decodeDocument({
    scenario: run.scenarioSnapshot,
    view: submitted.view,
  });
  assertIntegrity(snapshot);
  if (
    normalizedScenario(snapshot.scenario) !==
    normalizedScenario(submitted.scenario)
  )
    fail();
  const expected = orderedPayments(submitted.scenario.payments);
  const nodeIndex = new Map(snapshot.scenario.nodes.map((n) => [n.id, n]));
  const associationIds = new Set(
    snapshot.scenario.associations.map((a) => a.id),
  );
  const eventIndex = new Map(expected.map((p, i) => [p.id, i]));
  const events = list(run.events, MAX_PAYMENTS, "events");
  const profileIndex = new Map(profiles?.events.map((p) => [p.eventId, p]));
  if (events.length !== expected.length) fail();
  for (const [index, raw] of events.entries()) {
    const event = object(
      raw,
      [
        "eventId",
        "sequenceIndex",
        "occurredAt",
        "amountMinor",
        "accountId",
        "merchantId",
        "deviceId",
        "locationId",
        "features",
        "ruleEvaluations",
        "rawScore",
        "riskScore",
        "decision",
        "model",
        "cardPattern",
        "cardScores",
      ],
      "event result",
    );
    const payment = expected[index]!;
    const profile = profileIndex.get(payment.id);
    const amountProfile = profile?.signals.find(
      (s) => s.evaluation.ruleId === "unusual_amount",
    );
    if (event.eventId !== payment.id || event.sequenceIndex !== index) fail();
    for (const key of [
      "occurredAt",
      "amountMinor",
      "accountId",
      "merchantId",
      "deviceId",
      "locationId",
    ] as const)
      if (event[key] !== payment[key]) fail();
    if (learned) {
      const model = decodeModel(event.model);
      if (
        !payment.modelInput ||
        model.version !==
          (adapted
            ? "ml-upload-v9"
            : precision
              ? "ml-upload-v8"
              : coverage
                ? "ml-upload-v7"
                : sequence
                  ? "ml-upload-v5"
                  : "ml-v13") ||
        event.rawScore !== null ||
        event.riskScore !== null ||
        list(event.ruleEvaluations, 6, "rules").length ||
        event.decision !== (model.alert ? "review" : "approve")
      )
        fail();
      const suggestion = decodeCardPattern(event.cardPattern);
      const cardScores = decodeCardScores(event.cardScores);
      if (
        model.score &&
        model.score.source !==
          (payment.modelInput?.channel === "Online Transaction"
            ? adapted
              ? "adapted_online"
              : "online_specialist"
            : adapted
              ? "adapted_card"
              : "coverage")
      )
        fail();
      if (
        cardScores &&
        (!(precision || adapted) ||
          payment.modelInput?.channel === "Online Transaction" ||
          cardScores.historyCount !== model.historyCount ||
          cardScores.reviewSuggested !==
            (cardScores.pattern.distance >= 0 && !model.alert) ||
          cardScores.reviewSuggested !== Boolean(suggestion))
      )
        fail();
      if (
        cardScores &&
        suggestion &&
        (cardScores.bundleSha256 !== suggestion.bundleSha256 ||
          cardScores.pattern.rawMargin !== suggestion.margin ||
          cardScores.pattern.referenceThreshold !== suggestion.threshold ||
          cardScores.priority.rawMargin !== suggestion.priority?.margin ||
          cardScores.prioritized !==
            (suggestion.priority?.level === "prioritized"))
      )
        fail();
      if (
        suggestion &&
        (!(precision || adapted) ||
          model.alert ||
          payment.modelInput?.channel === "Online Transaction" ||
          suggestion.historyCount !== model.historyCount)
      )
        fail();
      const features = object(
        event.features,
        [
          "amountMinor",
          "typicalAmountMinor",
          "fiveMinuteAttemptCount",
          "newDevice",
          "unusualLocation",
          "categoryDeviation",
          "sharedDeviceAccountCount",
        ],
        "legacy features",
      );
      if (
        features.amountMinor !== payment.amountMinor ||
        Object.entries(features).some(
          ([key, value]) => key !== "amountMinor" && value !== null,
        )
      )
        fail();
      continue;
    }
    if (
      event.model != null ||
      event.cardPattern != null ||
      event.cardScores != null
    )
      fail();
    integer(event.rawScore, 0, 155, "raw score");
    integer(event.riskScore, 0, 100, "risk score");
    if (
      event.riskScore !== Math.min(100, event.rawScore) ||
      event.decision !==
        (event.riskScore >= submitted.scenario.policy.blockThreshold
          ? "block"
          : event.riskScore >= submitted.scenario.policy.reviewThreshold
            ? "review"
            : "approve")
    )
      fail();
    const features = object(
      event.features,
      [
        "amountMinor",
        "typicalAmountMinor",
        "fiveMinuteAttemptCount",
        "newDevice",
        "unusualLocation",
        "categoryDeviation",
        "sharedDeviceAccountCount",
      ],
      "features",
    );
    integer(features.amountMinor, 1, 100000000, "amount");
    const unavailable = payment.unavailableRules || [];
    if (!unavailable.includes("unusual_amount"))
      integer(
        features.typicalAmountMinor,
        1,
        profiles ? 3_000_000_000_000 : 100000000,
        "baseline",
      );
    const account = nodeIndex.get(payment.accountId);
    if (
      features.amountMinor !== payment.amountMinor ||
      account?.type !== "account" ||
      features.typicalAmountMinor !==
        (unavailable.includes("unusual_amount")
          ? null
          : amountProfile
            ? amountProfile.medianMinor
            : account.typicalAmountMinor)
    )
      fail();
    for (const [key, rule, max] of [
      ["fiveMinuteAttemptCount", "payment_velocity", MAX_PAYMENTS],
      ["sharedDeviceAccountCount", "shared_device_accounts", MAX_OBJECTS],
    ] as const) {
      if (unavailable.includes(rule)) {
        if (features[key] !== null) fail();
      } else integer(features[key], 1, max, key);
    }
    for (const [key, rule] of [
      ["newDevice", "new_device"],
      ["unusualLocation", "unusual_location"],
      ["categoryDeviation", "merchant_category_deviation"],
    ] as const)
      if (
        unavailable.includes(rule)
          ? features[key] !== null
          : typeof features[key] !== "boolean"
      )
        fail();
    const rules = list(event.ruleEvaluations, 6, "rules");
    if (rules.length !== 6) fail();
    let points = 0;
    for (const [ruleIndex, rawRule] of rules.entries()) {
      const rule = object(
        rawRule,
        [
          "ruleId",
          "available",
          "triggered",
          "points",
          "measured",
          "thresholds",
          "evidence",
          "explanation",
        ],
        "rule",
      );
      if (rule.ruleId !== ruleIds[ruleIndex]) fail();
      const profiledRule = profile?.signals.find(
        (s) => s.evaluation.ruleId === rule.ruleId,
      )?.evaluation;
      if (
        profiledRule &&
        Object.keys(profiledRule).some(
          (key) =>
            JSON.stringify(rule[key]) !==
            JSON.stringify(profiledRule[key as keyof typeof profiledRule]),
        )
      )
        fail();
      const available = !unavailable.includes(ruleIds[ruleIndex]!);
      if (rule.available !== undefined && typeof rule.available !== "boolean")
        fail();
      if (
        (rule.available ?? true) !== available ||
        (!available && rule.points !== 0)
      )
        fail();
      integer(rule.points, 0, 45, "points");
      points += rule.points;
      if (rule.triggered !== rule.points > 0) fail();
      text(rule.explanation, "explanation", 2000);
      for (const key of ["measured", "thresholds"]) {
        if (
          !rule[key] ||
          typeof rule[key] !== "object" ||
          Array.isArray(rule[key])
        )
          fail();
        for (const measured of Object.values(
          rule[key] as Record<string, unknown>,
        )) {
          if (key === "thresholds")
            integer(measured, 0, 100000000, "threshold");
          else if (!(
            typeof measured === "string" ||
            typeof measured === "boolean" ||
            (typeof measured === "number" && Number.isSafeInteger(measured)) ||
            (Array.isArray(measured) &&
              measured.every((v) => typeof v === "string"))
          ))
            fail();
        }
      }
      const evidence = object(
        rule.evidence,
        [
          "eventIds",
          "eventCount",
          "accountIds",
          "associationIds",
          "deviceId",
          "locationId",
          "observedAt",
          "knownFrom",
          "windowStart",
          "windowEnd",
        ],
        "evidence",
      );
      const evidenceEvents = list(
        evidence.eventIds,
        MAX_EVIDENCE_EVENTS,
        "evidence events",
      );
      if (evidence.eventCount != null) {
        integer(evidence.eventCount, 0, MAX_PAYMENTS, "evidence count");
        if (evidence.eventCount < evidenceEvents.length) fail();
      }
      for (const id of evidenceEvents) {
        identifier(id);
        const priorIndex = eventIndex.get(id);
        if (
          priorIndex === undefined ||
          priorIndex >=
            index + (rule.ruleId === "shared_device_accounts" ? 1 : 0)
        )
          fail();
      }
      for (const id of list(
        evidence.accountIds,
        MAX_OBJECTS,
        "evidence accounts",
      )) {
        identifier(id);
        if (nodeIndex.get(id)?.type !== "account") fail();
      }
      for (const id of list(
        evidence.associationIds,
        MAX_ASSOCIATIONS,
        "evidence relationships",
      )) {
        identifier(id);
        if (!associationIds.has(id)) fail();
      }
      for (const key of ["deviceId", "locationId"])
        if (evidence[key] !== null) {
          identifier(evidence[key]);
          if (!nodeIndex.has(evidence[key] as string)) fail();
        }
      for (const key of ["observedAt", "knownFrom", "windowStart", "windowEnd"])
        if (evidence[key] !== null) timestamp(evidence[key]);
    }
    if (points !== event.rawScore) fail();
  }
  const m = object(
    run.metrics,
    [
      "totalCount",
      "totalAmountMinor",
      "decisions",
      "decisionRates",
      "flaggedCount",
      "flaggedRate",
      "reviewWorkload",
      "scoreBins",
      "ruleTriggerCounts",
      "labeledCount",
      "unlabeledCount",
      "truthMetrics",
      "costs",
    ],
    "metrics",
  );
  for (const key of [
    "totalCount",
    "flaggedCount",
    "reviewWorkload",
    "labeledCount",
    "unlabeledCount",
  ])
    integer(m[key], 0, MAX_PAYMENTS, key);
  totalMoney(m.totalAmountMinor);
  rate(m.flaggedRate);
  const counts = object(m.decisions, [...decisions], "decisions"),
    rates = object(m.decisionRates, [...decisions], "rates");
  for (const d of decisions) {
    countAmount(counts[d]);
    rate(rates[d]);
  }
  const bins = object(
    m.scoreBins,
    ["0-19", "20-39", "40-59", "60-79", "80-100"],
    "score bins",
  );
  for (const key of ["0-19", "20-39", "40-59", "60-79", "80-100"])
    integer(bins[key], 0, MAX_PAYMENTS, "bin");
  const triggers = object(m.ruleTriggerCounts, [...ruleIds], "rule counts");
  for (const key of ruleIds)
    integer(triggers[key], 0, MAX_PAYMENTS, "rule count");
  if (m.truthMetrics !== null) {
    const truth = object(
      m.truthMetrics,
      [
        "fraudulent",
        "legitimate",
        "blockedFraud",
        "approvedFraud",
        "pendingFraud",
        "blockedLegitimate",
        "legitimateBlockRate",
        "fraudBlockRate",
        "fraudApprovalRate",
      ],
      "truth metrics",
    );
    for (const key of [
      "fraudulent",
      "legitimate",
      "blockedFraud",
      "approvedFraud",
      "pendingFraud",
      "blockedLegitimate",
    ])
      countAmount(truth[key]);
    for (const key of [
      "legitimateBlockRate",
      "fraudBlockRate",
      "fraudApprovalRate",
    ])
      rate(truth[key]);
  }
  const costs = object(
    m.costs,
    [
      "reviewOperatingCostAllMinor",
      "estimatedApprovedFraudLossMinor",
      "labeledReviewCostMinor",
      "estimatedFalseBlockFrictionCostMinor",
      "illustrativeLabeledTotalCostMinor",
    ],
    "costs",
  );
  totalMoney(costs.reviewOperatingCostAllMinor);
  for (const key of [
    "reviewOperatingCostAllMinor",
    "estimatedApprovedFraudLossMinor",
    "labeledReviewCostMinor",
    "estimatedFalseBlockFrictionCostMinor",
    "illustrativeLabeledTotalCostMinor",
  ])
    if (costs[key] !== null) totalMoney(costs[key]);
  for (const raw of list(run.warnings, 100, "warnings")) {
    const warning = object(raw, ["code", "message"], "warning");
    text(warning.code, "warning code");
    text(warning.message, "warning", 2000);
  }
  const result = value as Run;
  if (
    result.metrics.totalCount !== expected.length ||
    result.metrics.totalAmountMinor !==
      expected.reduce((sum, p) => sum + p.amountMinor, 0)
  )
    fail();
  for (const d of decisions) {
    const matching = result.events.filter((e) => e.decision === d);
    if (
      result.metrics.decisions[d]!.count !== matching.length ||
      result.metrics.decisions[d]!.amountMinor !==
        matching.reduce((sum, e) => sum + e.amountMinor, 0)
    )
      fail();
  }
  if (
    Object.values(result.metrics.scoreBins).reduce((a, b) => a + b, 0) !==
      (learned ? 0 : expected.length) ||
    result.metrics.labeledCount !==
      Object.keys(snapshot.scenario.groundTruth).length ||
    result.metrics.unlabeledCount + result.metrics.labeledCount !==
      expected.length ||
    (result.metrics.truthMetrics === null) !==
      (result.metrics.labeledCount === 0)
  )
    fail();
  const metrics = result.metrics;
  const checkRate = (
    value: { numerator: number; denominator: number } | null | undefined,
    numerator: number,
    denominator: number,
  ) => {
    if (
      denominator
        ? !value ||
          value.numerator !== numerator ||
          value.denominator !== denominator
        : value !== null
    )
      fail();
  };
  for (const d of decisions)
    checkRate(
      metrics.decisionRates[d],
      metrics.decisions[d]!.count,
      expected.length,
    );
  const flagged =
    metrics.decisions.review!.count + metrics.decisions.block!.count;
  if (
    metrics.flaggedCount !== flagged ||
    metrics.reviewWorkload !== metrics.decisions.review!.count
  )
    fail();
  checkRate(metrics.flaggedRate, flagged, expected.length);
  for (const [bin, count] of Object.entries(metrics.scoreBins)) {
    const [low, high] = bin.split("-").map(Number);
    if (
      count !==
      result.events.filter(
        (e) =>
          e.riskScore !== null && e.riskScore >= low! && e.riskScore <= high!,
      ).length
    )
      fail();
  }
  for (const rule of ruleIds)
    if (
      metrics.ruleTriggerCounts[rule] !==
      result.events.filter((e) =>
        e.ruleEvaluations.some((r) => r.ruleId === rule && r.triggered),
      ).length
    )
      fail();
  const truth = metrics.truthMetrics;
  if (truth) {
    const fraud = result.events.filter(
      (e) => snapshot.scenario.groundTruth[e.eventId] === "fraudulent",
    );
    const legitimate = result.events.filter(
      (e) => snapshot.scenario.groundTruth[e.eventId] === "legitimate",
    );
    const sets = {
      fraudulent: fraud,
      legitimate,
      blockedFraud: fraud.filter((e) => e.decision === "block"),
      approvedFraud: fraud.filter((e) => e.decision === "approve"),
      pendingFraud: fraud.filter((e) => e.decision === "review"),
      blockedLegitimate: legitimate.filter((e) => e.decision === "block"),
    };
    for (const [key, events] of Object.entries(sets)) {
      const pair = truth[key as keyof typeof sets];
      if (
        pair.count !== events.length ||
        pair.amountMinor !== events.reduce((sum, e) => sum + e.amountMinor, 0)
      )
        fail();
    }
    checkRate(
      truth.fraudBlockRate,
      truth.blockedFraud.count,
      truth.fraudulent.count,
    );
    checkRate(
      truth.fraudApprovalRate,
      truth.approvedFraud.count,
      truth.fraudulent.count,
    );
    checkRate(
      truth.legitimateBlockRate,
      truth.blockedLegitimate.count,
      truth.legitimate.count,
    );
  }
  const c = metrics.costs;
  for (const key of [
    "estimatedApprovedFraudLossMinor",
    "labeledReviewCostMinor",
    "estimatedFalseBlockFrictionCostMinor",
    "illustrativeLabeledTotalCostMinor",
  ] as const)
    if ((c[key] === null) !== !truth) fail();
  if (
    truth &&
    c.illustrativeLabeledTotalCostMinor !==
      c.estimatedApprovedFraudLossMinor! +
        c.labeledReviewCostMinor! +
        c.estimatedFalseBlockFrictionCostMinor!
  )
    fail();
  return result;
}
