import { isLearnedEngine } from "../../domain/model";
import { PaymentPages } from "../PaymentPages";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { decodeDocument } from "../../api/decode";
import { compareRuns, signed, rateDifference } from "../../domain/comparison";
import { groupId, money } from "../../domain/types";
import type { Selection } from "../../domain/types";
import type { CapturedRun } from "../../state/simulation";
import { useSimulation } from "../../state/simulation";
import { Graph } from "../graph/Graph";

const noAction = () => {};
const amount = (n: number | null) => (n === null ? "N/A" : money(n));
const rate = (n: { numerator: number; denominator: number } | null) =>
  !n?.denominator
    ? "N/A"
    : `${((100 * n.numerator) / n.denominator).toFixed(1)}% (${n.numerator}/${n.denominator})`;

export function Comparison({
  before,
  after,
  close,
}: {
  before: CapturedRun;
  after: CapturedRun;
  close: () => void;
}) {
  const comparison = useMemo(
    () => compareRuns(before.result, after.result),
    [before, after],
  );
  const [side, setSide] = useState<"before" | "after">("after");
  const [selection, setSelection] = useState<Selection>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const detailElement = useRef<HTMLElement>(null);
  useEffect(() => {
    detailElement.current?.scrollIntoView({ block: "nearest" });
  }, [eventId]);
  const captured = side === "after" ? after : before;
  const document = useMemo(
    () => decodeDocument(structuredClone(captured.document)),
    [captured],
  );
  const paths = useMemo(() => {
    const groups = new Map<string, { count: number; label: string }>();
    for (const delta of comparison.events) {
      const event = delta[side];
      if (!delta.changed || !event) continue;
      const key = groupId(event.accountId, event.merchantId);
      const group = groups.get(key);
      if (group) group.count++;
      else
        groups.set(key, {
          count: 1,
          label:
            delta.before && delta.after
              ? `${delta.before.decision} → ${delta.after.decision}${delta.after.riskScore !== null && delta.before.riskScore !== null ? ` · ${signed(delta.after.riskScore - delta.before.riskScore)}` : " · Learned model"}`
              : side === "after"
                ? "Added"
                : "Removed",
        });
    }
    return Object.fromEntries(
      [...groups].map(([key, group]) => [
        key,
        group.count > 1 ? `${group.count} changed payments` : group.label,
      ]),
    );
  }, [comparison, side]);
  const filtered = comparison.events.filter((d) => {
    if (!selection) return d.changed;
    const e = d[side];
    if (!e) return false;
    if (selection.kind === "group")
      return groupId(e.accountId, e.merchantId) === selection.id;
    if (selection.kind === "node")
      return [e.accountId, e.merchantId, e.deviceId, e.locationId].includes(
        selection.id,
      );
    const a = document.scenario.associations.find((a) => a.id === selection.id);
    return (
      a &&
      a.accountId === e.accountId &&
      [e.deviceId, e.locationId].includes(a.targetId)
    );
  });
  const detail = comparison.events.find((e) => e.id === eventId);
  const a = before.result.metrics,
    b = after.result.metrics;
  const scalar = (
    label: string,
    old: number | null,
    next: number | null,
    currency = false,
  ) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {currency ? amount(old) : (old ?? "N/A")} →{" "}
        {currency ? amount(next) : (next ?? "N/A")}
        <small>
          {old === null || next === null
            ? "Delta unavailable"
            : currency
              ? `${next - old >= 0 ? "+" : "−"}${money(Math.abs(next - old))}`
              : signed(next - old)}
        </small>
      </dd>
    </div>
  );
  const rates = (
    label: string,
    old: { numerator: number; denominator: number } | null,
    next: { numerator: number; denominator: number } | null,
  ) => {
    const delta = rateDifference(old, next);
    return (
      <div key={label}>
        <dt>{label}</dt>
        <dd>
          {rate(old)} → {rate(next)}
          <small>
            {delta === null
              ? "Delta unavailable"
              : `${signed(Number(delta.toFixed(1)))} percentage points`}
          </small>
        </dd>
      </div>
    );
  };
  return (
    <main
      className="workspace comparison panel-open"
      aria-label="Run comparison"
    >
      <Graph
        key={captured.result.runId}
        snapshot={document}
        add={noAction}
        comparison={paths}
        focusPaymentId={eventId || undefined}
        inspect={(s) => {
          setSelection(s);
          setEventId(null);
        }}
      />
      <header className="topbar">
        <div className="brand">RiskFlow</div>
        <div className="snapshot-name">
          {document.scenario.name}
          <small>Two captured runs · {side} snapshot</small>
        </div>
        <div className="top-actions">
          <button
            aria-pressed={side === "before"}
            onClick={() => {
              setSide("before");
              setSelection(null);
            }}
          >
            Before
          </button>
          <button
            aria-pressed={side === "after"}
            onClick={() => {
              setSide("after");
              setSelection(null);
            }}
          >
            After
          </button>
          <button onClick={close}>Back to replay</button>
          <button onClick={() => useSimulation.getState().edit()}>
            Edit scenario
          </button>
        </div>
      </header>
      <aside
        className="card inspector run-inspector"
        aria-label="Comparison details"
      >
        <div className="kicker">Before → After</div>
        <h2>What changed</h2>
        <p>{comparison.basis.join(" · ")}</p>
        {Object.entries(comparison.transitions).map(([transition, count]) => (
          <p key={transition}>
            <strong>
              {count} {transition}
            </strong>
          </p>
        ))}
        <p>
          {comparison.added} added · {comparison.removed} removed payments.{" "}
          {comparison.populationChanged
            ? "Totals cover different payment populations."
            : "Same payment population."}
        </p>
        <details>
          <summary>Thresholds &amp; assumptions</summary>
          <dl className="facts">
            {!isLearnedEngine(before.result.engineVersion) &&
              !isLearnedEngine(after.result.engineVersion) && (
                <>
                  {scalar(
                    "Review threshold",
                    before.result.scenarioSnapshot.policy.reviewThreshold,
                    after.result.scenarioSnapshot.policy.reviewThreshold,
                  )}
                  {scalar(
                    "Block threshold",
                    before.result.scenarioSnapshot.policy.blockThreshold,
                    after.result.scenarioSnapshot.policy.blockThreshold,
                  )}
                </>
              )}
            {scalar(
              "Cost per review",
              before.result.scenarioSnapshot.costAssumptions.reviewCostMinor,
              after.result.scenarioSnapshot.costAssumptions.reviewCostMinor,
              true,
            )}
            {scalar(
              "Cost per false block",
              before.result.scenarioSnapshot.costAssumptions
                .falseBlockCostMinor,
              after.result.scenarioSnapshot.costAssumptions.falseBlockCostMinor,
              true,
            )}
            {scalar(
              "Approved fraud loss · percent",
              before.result.scenarioSnapshot.costAssumptions
                .approvedFraudLossBps / 100,
              after.result.scenarioSnapshot.costAssumptions
                .approvedFraudLossBps / 100,
            )}
          </dl>
        </details>
        <p>
          <strong>
            {amount(a.costs.illustrativeLabeledTotalCostMinor)} →{" "}
            {amount(b.costs.illustrativeLabeledTotalCostMinor)}
          </strong>{" "}
          · illustrative labeled cost
        </p>
        <details>
          <summary>Completed totals</summary>
          <dl className="facts">
            {scalar("Payments", a.totalCount, b.totalCount)}
            {scalar(
              "Attempted amount",
              a.totalAmountMinor,
              b.totalAmountMinor,
              true,
            )}
            {(["approve", "review", "block"] as const).map((d) => (
              <Fragment key={d}>
                {scalar(
                  `${d} count`,
                  a.decisions[d]!.count,
                  b.decisions[d]!.count,
                )}
                {scalar(
                  `${d} amount`,
                  a.decisions[d]!.amountMinor,
                  b.decisions[d]!.amountMinor,
                  true,
                )}
                {rates(`${d} rate`, a.decisionRates[d]!, b.decisionRates[d]!)}
              </Fragment>
            ))}
            {rates("Flagged rate", a.flaggedRate, b.flaggedRate)}
            {scalar(
              "Illustrative labeled cost",
              a.costs.illustrativeLabeledTotalCostMinor,
              b.costs.illustrativeLabeledTotalCostMinor,
              true,
            )}
          </dl>
          <p>
            Modeled consequences under each run’s assumptions; a cost decrease
            alone does not establish a policy improvement.
          </p>
        </details>
        <details>
          <summary>Truth coverage &amp; cost detail</summary>
          <p>
            {comparison.labelsChanged ? "Labels changed." : "Labels unchanged."}{" "}
            {comparison.coverageChanged
              ? "Labeled coverage changed."
              : "Labeled coverage unchanged."}
          </p>
          <dl className="facts">
            {scalar("Labeled payments", a.labeledCount, b.labeledCount)}
            {scalar("Unlabeled payments", a.unlabeledCount, b.unlabeledCount)}
            {rates(
              "Fraud block rate",
              a.truthMetrics?.fraudBlockRate ?? null,
              b.truthMetrics?.fraudBlockRate ?? null,
            )}
            {rates(
              "Fraud approval rate",
              a.truthMetrics?.fraudApprovalRate ?? null,
              b.truthMetrics?.fraudApprovalRate ?? null,
            )}
            {rates(
              "Legitimate block rate",
              a.truthMetrics?.legitimateBlockRate ?? null,
              b.truthMetrics?.legitimateBlockRate ?? null,
            )}
            {scalar(
              "Approved fraud loss",
              a.costs.estimatedApprovedFraudLossMinor,
              b.costs.estimatedApprovedFraudLossMinor,
              true,
            )}
            {scalar(
              "Labeled review cost",
              a.costs.labeledReviewCostMinor,
              b.costs.labeledReviewCostMinor,
              true,
            )}
            {scalar(
              "False-block friction",
              a.costs.estimatedFalseBlockFrictionCostMinor,
              b.costs.estimatedFalseBlockFrictionCostMinor,
              true,
            )}
            {scalar(
              "All-review operating cost",
              a.costs.reviewOperatingCostAllMinor,
              b.costs.reviewOperatingCostAllMinor,
              true,
            )}
          </dl>
        </details>
        <h3>
          {selection ? "Selected object / connection" : "Changed payments"}
        </h3>
        {selection && (
          <button onClick={() => setSelection(null)}>Show all changes</button>
        )}
        {!filtered.length && <p>No changed payments in this view.</p>}
        <PaymentPages
          key={`${side}:${selection?.kind}:${selection?.id}`}
          items={filtered}
          identify={(d) => d.id}
        >
          {(d) => (
            <button
              key={d.id}
              className="wide"
              aria-label={`Compare ${d.id}`}
              onClick={() => setEventId(d.id)}
            >
              {d.id} · {d.before?.decision || "Added"} →{" "}
              {d.after?.decision || "Removed"}
              {d.before?.riskScore != null && d.after?.riskScore != null
                ? ` · ${signed(d.after.riskScore - d.before.riskScore)}`
                : ""}
            </button>
          )}
        </PaymentPages>
        {detail && (
          <section ref={detailElement} aria-label="Payment changes">
            <h3>{detail.id}</h3>
            {detail.before?.model || detail.after?.model ? (
              <p>
                Learned model comparison · raw margins are not probabilities.
              </p>
            ) : (
              <p>
                {detail.before?.riskScore ?? "—"} →{" "}
                {detail.after?.riskScore ?? "—"} / 100
              </p>
            )}
            <p>
              {detail.reasons.join(". ") ||
                "Payment facts and prior history unchanged; see policy and model assumptions."}
            </p>
            {detail.before && detail.after && (
              <p>
                {detail.reasons.includes("Payment fields changed")
                  ? "Payment record edited."
                  : "Payment record unchanged."}
              </p>
            )}
            {detail.before?.ruleEvaluations.map((rule) => {
              const next = detail.after?.ruleEvaluations.find(
                (r) => r.ruleId === rule.ruleId,
              );
              return (
                <details key={rule.ruleId}>
                  <summary>
                    {rule.ruleId.replaceAll("_", " ")} · {rule.points} →{" "}
                    {next?.points ?? "—"}
                  </summary>
                  <p>Before: {rule.explanation}</p>
                  <p>After: {next?.explanation || "Payment removed"}</p>
                  <p>
                    Evidence: {rule.evidence.eventIds?.join(", ") || "None"} →{" "}
                    {next?.evidence.eventIds?.join(", ") || "None"}
                  </p>
                </details>
              );
            })}
            {(["before", "after"] as const).map((which) => {
              const snapshot = (which === "before" ? before : after).result
                .scenarioSnapshot;
              const payment = snapshot.payments.find((p) => p.id === detail.id);
              return (
                <details key={which}>
                  <summary>{which} captured payment and context</summary>
                  {!payment ? (
                    <p>Payment absent in this snapshot.</p>
                  ) : (
                    <>
                      <p>
                        {money(payment.amountMinor)} · {payment.occurredAt} ·
                        UTC
                      </p>
                      <p>
                        Truth: {snapshot.groundTruth[payment.id] || "Unlabeled"}
                      </p>
                      {snapshot.nodes
                        .filter((n) =>
                          [
                            payment.accountId,
                            payment.merchantId,
                            payment.deviceId,
                            payment.locationId,
                          ].includes(n.id),
                        )
                        .map((n) => (
                          <details key={n.id}>
                            <summary>
                              {n.type}: {n.name}
                            </summary>
                            <dl className="facts">
                              {Object.entries(n)
                                .filter(
                                  ([key]) =>
                                    !["id", "name", "type"].includes(key),
                                )
                                .map(([key, value]) => (
                                  <div key={key}>
                                    <dt>
                                      {key.replace(
                                        /[A-Z]/g,
                                        (c) => ` ${c.toLowerCase()}`,
                                      )}
                                    </dt>
                                    <dd>
                                      {Array.isArray(value)
                                        ? value.join(", ")
                                        : String(value)}
                                    </dd>
                                  </div>
                                ))}
                            </dl>
                          </details>
                        ))}
                      {snapshot.associations
                        .filter(
                          (r) =>
                            r.accountId === payment.accountId &&
                            [payment.deviceId, payment.locationId].includes(
                              r.targetId,
                            ),
                        )
                        .map((r) => (
                          <p key={r.id}>
                            {r.type === "accountDevice" ? "Device" : "Location"}
                            : observed {r.observedAt}; familiar from{" "}
                            {r.knownFrom || "unknown"}.
                          </p>
                        ))}
                    </>
                  )}
                </details>
              );
            })}
          </section>
        )}
        <details>
          <summary>Run versions</summary>
          <p>
            Before {before.result.completedAt}
            <br />
            After {after.result.completedAt}
          </p>
        </details>
      </aside>
      <div className="status" role="status">
        Select a highlighted connection to inspect its changes.
      </div>
    </main>
  );
}
