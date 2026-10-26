import { CloseIcon } from "../CloseIcon";
import { assessmentText, isLearnedEngine } from "../../domain/model";
import {
  recentTransactionGlows,
  TRANSACTION_GLOW_DURATION,
} from "../graph/growth";
import { PaymentPages } from "../PaymentPages";
import { CardPatternDetails } from "../CardPatternDetails";
import { CardReviewQueue } from "../CardReviewQueue";
import { ContinuousScores } from "../ContinuousScores";
import { ScoreExplorer } from "../ScoreExplorer";
import { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { decodeDocument } from "../../api/decode";
import { money, groupId } from "../../domain/types";
import type { Selection } from "../../domain/types";
import {
  playbackPosition,
  presentationSchedule,
  PLAYBACK_SPEEDS,
} from "../../domain/runs";
import { useSimulation } from "../../state/simulation";
import type { CapturedRun } from "../../state/simulation";
import { Graph } from "../graph/Graph";
import { Comparison } from "../results/Comparison";

const title = (value: string) => value.replaceAll("_", " ");
const rate = (value: { numerator: number; denominator: number } | null) =>
  value
    ? `${((100 * value.numerator) / value.denominator).toFixed(1)}% (${value.numerator}/${value.denominator})`
    : "N/A";
const amount = (value: number | null) =>
  value === null ? "N/A" : money(value);
const noAction = () => {};

export function Replay({
  captured,
  openSamples,
}: {
  captured: CapturedRun;
  openSamples: () => void;
}) {
  const state = useSimulation();
  const flow = useReactFlow();
  const document = useMemo(
    () => decodeDocument(structuredClone(captured.document)),
    [captured],
  );
  const run = captured.result;
  const retained = captured.assessment;
  const assessments = useMemo(
    () => new Map(retained?.assessments.map((item) => [item.eventId, item])),
    [retained],
  );
  const sourceId = (id: string) => assessments.get(id)?.sourceEventId ?? id;
  const outcome = (event: (typeof run.events)[number]) =>
    event.model
      ? event.model.alert
        ? "review"
        : "no alert"
      : retained
        ? (
            assessments.get(event.eventId)?.recommendation ?? "not_assessed"
          ).replaceAll("_", " ")
        : event.decision;
  const score = (event: (typeof run.events)[number]) =>
    event.model
      ? event.model.score
        ? `${event.model.score.value.toFixed(2)}${event.model.score.probabilityAvailable ? "%" : "/100"}`
        : "Score unavailable"
      : retained && assessments.get(event.eventId)?.score === null
        ? "No score"
        : `${event.riskScore}/100`;
  const decisionLabel = (value: string) =>
    retained || isLearnedEngine(run.engineVersion)
      ? ({ approve: "no alert", review: "review", block: "high priority" }[
          value
        ] ?? value)
      : value;
  const schedule = useMemo(() => presentationSchedule(run.events), [run]);
  const position = playbackPosition(schedule, state.elapsed);
  const [panel, setPanel] = useState<
    "events" | "event" | "results" | "object" | null
  >(null);
  const [selected, setSelected] = useState(-1);
  const [comparing, setComparing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [evidenceIds, setEvidenceIds] = useState<readonly string[]>([]);
  const revealed = useMemo(
    () => run.events.slice(0, position.cursor + 1),
    [run, position.cursor],
  );
  const revealedIds = useMemo(
    () => revealed.map((event) => event.eventId),
    [revealed],
  );
  const event = panel === "event" ? run.events[selected] : undefined;
  const active = run.events[position.active];
  const current = active || run.events[position.cursor];
  const contextTime =
    current?.occurredAt || run.scenarioSnapshot.scenarioStartAt;
  const end = schedule.at(-1)?.end || 0;
  const [afterglow, setAfterglow] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const tail = position.completed
        ? Math.min(
            TRANSACTION_GLOW_DURATION,
            (performance.now() - start) * 1.25,
          )
        : 0;
      setAfterglow(tail);
      if (position.completed && tail < TRANSACTION_GLOW_DURATION)
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [position.completed, captured]);
  const pulses = recentTransactionGlows(
    schedule,
    state.elapsed + (position.completed ? afterglow : 0),
  ).map((p) => ({
    eventId: run.events[p.index]!.eventId,
    progress: p.progress,
  }));

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || comparing) return;
      setPanel(null);
      setEvidenceIds([]);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [comparing]);

  useEffect(() => {
    if (!state.playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const s = useSimulation.getState();
      if (!s.playing || !s.viewing) return;
      const elapsed = Math.min(
        end,
        s.elapsed + (now - previous) * s.speed * 1.25,
      );
      previous = now;
      useSimulation.setState({ elapsed, playing: elapsed < end });
      if (elapsed < end) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (window.document.hidden) useSimulation.setState({ playing: false });
    };
    if (window.document.hidden) visibility();
    else frame = requestAnimationFrame(tick);
    window.document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.document.removeEventListener("visibilitychange", visibility);
    };
  }, [state.playing, end, captured]);

  function seek(index: number) {
    useSimulation.setState({
      elapsed: index < 0 ? 0 : schedule[index]!.end,
      playing: false,
    });
    setSelected(index);
    setEvidenceIds([]);
    setPanel(null);
  }
  function inspectPayment(index: number) {
    useSimulation.setState({ playing: false });
    setSelected(index);
    setEvidenceIds([]);
    setPanel("event");
  }
  function play(restart = false) {
    setPanel(null);
    setEvidenceIds([]);
    useSimulation.setState({
      playing: true,
      ...(restart || position.completed ? { elapsed: 0 } : {}),
    });
  }
  const inspect = (s: Selection) => {
    useSimulation.setState({ playing: false });
    setSelection(s);
    setPanel(s ? "object" : null);
    setEvidenceIds([]);
  };
  const node =
    selection?.kind === "node"
      ? document.scenario.nodes.find((n) => n.id === selection.id)
      : undefined;
  const association =
    selection?.kind === "association"
      ? document.scenario.associations.find((a) => a.id === selection.id)
      : undefined;
  const related = selection
    ? revealed.filter((e) =>
        selection.kind === "node"
          ? [e.accountId, e.merchantId, e.deviceId, e.locationId].includes(
              selection.id,
            )
          : selection.kind === "group"
            ? groupId(e.accountId, e.merchantId) === selection.id
            : association
              ? e.accountId === association.accountId &&
                [e.deviceId, e.locationId].includes(association.targetId)
              : false,
      )
    : [];
  const m = run.metrics;
  if (comparing && state.previous)
    return (
      <Comparison
        before={state.previous}
        after={captured}
        close={() => setComparing(false)}
      />
    );
  return (
    <main
      className={`workspace replay ${panel ? "panel-open" : ""}`}
      aria-label="RiskFlow run snapshot"
    >
      <Graph
        key={run.runId}
        snapshot={document}
        add={noAction}
        inspect={inspect}
        revealedIds={revealedIds}
        decisions={revealed}
        evidenceIds={evidenceIds}
        focusPaymentId={event?.eventId}
        contextTime={contextTime}
        {...(event || active ? { eventId: (event || active)!.eventId } : {})}
        pulses={pulses}
      />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">rf</span>
          <span>RiskFlow</span>
        </div>
        <div className="snapshot-name">
          {run.scenarioSnapshot.name}
          <small>
            {retained ? "Saved retrospective assessment" : "Run snapshot"}{" "}
            {document.scenario.payments.length > 30
              ? " - select groups to explore"
              : " - drag to rearrange"}
          </small>
        </div>
        <div className="top-actions">
          <button
            className="primary samples-button"
            data-tour="samples"
            aria-haspopup="dialog"
            onClick={() => {
              useSimulation.setState({ playing: false });
              openSamples();
            }}
          >
            Samples
          </button>
          {state.previous && !retained && (
            <button
              onClick={() => {
                useSimulation.setState({ playing: false });
                setComparing(true);
              }}
            >
              Compare runs
            </button>
          )}
          <button
            aria-expanded={panel === "events"}
            aria-controls="run-payments"
            onClick={() => {
              useSimulation.setState({ playing: false });
              setPanel(panel === "events" ? null : "events");
            }}
          >
            Inspect payments
          </button>
          <button
            data-tour="results"
            aria-expanded={panel === "results"}
            onClick={() => {
              useSimulation.setState({ playing: false });
              setPanel(panel === "results" ? null : "results");
            }}
          >
            Results
          </button>
        </div>
      </header>
      {panel === "events" && (
        <section
          id="run-payments"
          className="card inspector run-inspector"
          aria-label="Run events"
        >
          <button
            className="close"
            aria-label="Close events"
            onClick={() => setPanel(null)}
          >
            <CloseIcon />
          </button>
          <h2>Payments</h2>
          <p>Select a payment to view its details.</p>
          <div className="event-list run-event-list">
            <PaymentPages
              items={run.events}
              identify={(e) => sourceId(e.eventId)}
            >
              {(e, index) => (
                <button
                  key={e.eventId}
                  className={
                    index <= position.cursor
                      ? `payment-result decision-${e.decision}`
                      : undefined
                  }
                  aria-label={`Inspect ${sourceId(e.eventId)}`}
                  onClick={() => inspectPayment(index)}
                >
                  <span>{sourceId(e.eventId)}</span>
                  <strong>{money(e.amountMinor)}</strong>
                  <span>
                    {index <= position.cursor ? outcome(e) : "Not revealed"}
                  </span>
                  {index <= position.cursor && <span>{score(e)}</span>}
                  {e.ruleEvaluations.some((r) => r.available === false) && (
                    <span>Limited data</span>
                  )}
                  {index <= position.cursor && e.cardPattern && (
                    <span>Additional card review</span>
                  )}
                </button>
              )}
            </PaymentPages>
          </div>
        </section>
      )}
      {panel === "event" && event && (
        <aside
          className="card inspector run-inspector"
          aria-label="Payment explanation"
        >
          <button
            className="close"
            aria-label="Close explanation"
            onClick={() => {
              setPanel(null);
              setEvidenceIds([]);
            }}
          >
            <CloseIcon />
          </button>
          <div className="kicker">
            {retained
              ? "Investigation recommendation"
              : "Recorded payment decision"}
          </div>
          <h2>
            {sourceId(event.eventId)} · {money(event.amountMinor)}
          </h2>
          <div className={`decision decision-${event.decision}`}>
            {outcome(event)} <strong>{score(event)}</strong>
          </div>
          {event.ruleEvaluations.some((r) => r.available === false) && (
            <p className="data-notice">
              Limited data ·{" "}
              {
                event.ruleEvaluations.filter((r) => r.available !== false)
                  .length
              }
              /6 rules evaluated. A low score is not evidence of safety.
            </p>
          )}
          <p>
            {event.occurredAt} · UTC
            <br />
            {
              document.scenario.nodes.find((n) => n.id === event.accountId)
                ?.name
            }{" "}
            →{" "}
            {
              document.scenario.nodes.find((n) => n.id === event.merchantId)
                ?.name
            }
          </p>
          {event.model ? (
            <section aria-label="Assessment evidence">
              <h3>Assessment evidence</h3>
              <p>
                {event.model.historyCount} prior completed purchases. Confirmed
                merchant-fraud feedback unavailable.
              </p>
              <p>
                {event.model.detectionPaths.length
                  ? `Alert paths: ${event.model.detectionPaths.map(title).join(", ")}`
                  : "No model alert threshold crossed."}
              </p>
              <details>
                <summary>Raw model margins</summary>
                <p>
                  Uncalibrated model outputs, not fraud probabilities or
                  additive rule points.
                </p>
                <dl className="facts">
                  {Object.entries(event.model.rawScores).map(
                    ([name, value]) => (
                      <div key={name}>
                        <dt>{title(name)}</dt>
                        <dd>{value.toFixed(4)}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
            </section>
          ) : (
            <p>
              Raw points {event.rawScore}
              {(event.rawScore ?? 0) > 100 ? " · capped at 100" : ""}. Review ≥{" "}
              {run.scenarioSnapshot.policy.reviewThreshold};{" "}
              {retained ? "high priority" : "block"} ≥{" "}
              {run.scenarioSnapshot.policy.blockThreshold}.
            </p>
          )}
          <ContinuousScores model={event.model} cards={event.cardScores} />
          <CardPatternDetails review={event.cardPattern} />
          {event.ruleEvaluations.map((rule) => (
            <details key={rule.ruleId} open={rule.triggered || undefined}>
              <summary>
                {title(rule.ruleId)}{" "}
                <strong>
                  {rule.available === false ? "N/A" : `+${rule.points}`}
                </strong>
              </summary>
              <p>{rule.explanation}</p>
              <details>
                <summary>Measurements &amp; evidence</summary>
                <dl className="facts">
                  {Object.entries(rule.measured).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {title(
                          key.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`),
                        )}
                      </dt>
                      <dd>
                        {Array.isArray(value)
                          ? value.join(", ")
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                  {Object.entries(rule.thresholds).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {rule.evidence.eventIds?.length
                    ? `Contributing payments${rule.evidence.eventCount && rule.evidence.eventCount > rule.evidence.eventIds.length ? ` (latest ${rule.evidence.eventIds.length} of ${rule.evidence.eventCount})` : ""}: ${rule.evidence.eventIds.map(sourceId).join(", ")}`
                    : "No contributing payment history."}
                </p>
                {rule.evidence.windowStart && (
                  <p>
                    Window: {rule.evidence.windowStart} through{" "}
                    {rule.evidence.windowEnd}, inclusive.
                  </p>
                )}
                {rule.evidence.observedAt && (
                  <p>
                    Observed: {rule.evidence.observedAt}
                    <br />
                    Familiar from:{" "}
                    {rule.evidence.knownFrom || "Not established"}
                  </p>
                )}
                {!!rule.evidence.eventIds?.length && (
                  <div className="inline-actions">
                    <button
                      onClick={() => setEvidenceIds(rule.evidence.eventIds!)}
                    >
                      Highlight evidence
                    </button>
                    <button
                      onClick={() => {
                        const ids = new Set<string>(
                          rule.evidence.accountIds || [],
                        );
                        if (rule.evidence.deviceId)
                          ids.add(rule.evidence.deviceId);
                        for (const e of run.events.filter((e) =>
                          rule.evidence.eventIds?.includes(e.eventId),
                        ))
                          for (const id of [
                            e.accountId,
                            e.merchantId,
                            e.deviceId,
                          ])
                            ids.add(id);
                        setEvidenceIds(rule.evidence.eventIds!);
                        void flow.fitView({
                          nodes: [...ids].map((id) => ({ id })),
                          padding: 0.4,
                          duration: 0,
                        });
                      }}
                    >
                      Focus evidence
                    </button>
                  </div>
                )}
              </details>
            </details>
          ))}
          <p className="fineprint">
            Synthetic truth label:{" "}
            {run.scenarioSnapshot.groundTruth[event.eventId] || "Unlabeled"}.
            Labels are excluded from scoring.
          </p>
        </aside>
      )}
      {panel === "object" && selection && (
        <aside className="card inspector" aria-label="Snapshot object details">
          <button
            className="close"
            aria-label="Close object details"
            onClick={() => setPanel(null)}
          >
            <CloseIcon />
          </button>
          <div className="kicker">Run snapshot</div>
          <h2>
            {node?.name ||
              (association ? "Context relationship" : "Payment connection")}
          </h2>
          {node && (
            <dl className="facts">
              {Object.entries(node).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>
                    {Array.isArray(value) ? value.join(", ") : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {association && (
            <p>
              Observed {association.observedAt}
              <br />
              Familiar from {association.knownFrom || "Not established"}
              <br />
              At playback time:{" "}
              {contextTime < association.observedAt
                ? "future"
                : association.knownFrom && contextTime >= association.knownFrom
                  ? "familiar"
                  : "observed"}
            </p>
          )}
          <h3>{related.length} revealed payments</h3>
          <p>
            {(["approve", "review", "block"] as const)
              .map(
                (d) =>
                  `${related.filter((e) => outcome(e) === decisionLabel(d)).length} ${decisionLabel(d)}`,
              )
              .join(" · ")}
            {retained &&
              ` · ${related.filter((e) => outcome(e) === "not assessed").length} not assessed`}
          </p>
          <PaymentPages
            key={`${selection?.kind}:${selection?.id}`}
            items={related}
            identify={(e) => sourceId(e.eventId)}
          >
            {(e) => (
              <button
                className="wide"
                key={e.eventId}
                onClick={() => inspectPayment(e.sequenceIndex)}
              >
                {sourceId(e.eventId)} · {money(e.amountMinor)} · {outcome(e)}
              </button>
            )}
          </PaymentPages>
        </aside>
      )}
      {panel === "results" && (
        <aside
          className="card inspector run-inspector"
          aria-label="Completed run totals"
          data-tour="results-panel"
        >
          <button
            className="close"
            aria-label="Close results"
            onClick={() => setPanel(null)}
          >
            <CloseIcon />
          </button>
          <div className="kicker">Completed run totals</div>
          <h2>
            {m.totalCount} payments · {money(m.totalAmountMinor)}
          </h2>
          <ScoreExplorer
            events={run.events}
            truth={run.scenarioSnapshot.groundTruth}
            sourceId={sourceId}
            inspect={(e) => inspectPayment(e.sequenceIndex)}
          />
          {["engine-ml-upload-v8", "engine-ml-upload-v9"].includes(
            run.engineVersion,
          ) && (
            <details className="card-pattern-review">
              <summary>
                Experimental card reviews (
                {run.events.filter((e) => e.cardPattern).length})
              </summary>
              <section aria-label="Additional card reviews">
                <h3>
                  {run.events.filter((e) => e.cardPattern).length} additional
                  card reviews
                </h3>
                <p>
                  Experimental pattern suggestions, separate from primary model
                  alerts. These purchases remain “no model alert” in the model
                  metrics below.
                </p>
                {run.events.some(
                  (e) =>
                    e.cardPattern &&
                    run.scenarioSnapshot.groundTruth[e.eventId],
                ) && (
                  <p>
                    Among labeled suggestions:{" "}
                    {
                      run.events.filter(
                        (e) =>
                          e.cardPattern &&
                          run.scenarioSnapshot.groundTruth[e.eventId] ===
                            "fraudulent",
                      ).length
                    }{" "}
                    fraudulent,{" "}
                    {
                      run.events.filter(
                        (e) =>
                          e.cardPattern &&
                          run.scenarioSnapshot.groundTruth[e.eventId] ===
                            "legitimate",
                      ).length
                    }{" "}
                    legitimate. Labels are used only for this comparison.
                  </p>
                )}
                <CardReviewQueue
                  events={run.events}
                  truth={run.scenarioSnapshot.groundTruth}
                  sourceId={sourceId}
                  inspect={(e) => inspectPayment(e.sequenceIndex)}
                />
              </section>
            </details>
          )}
          {retained && (
            <p className="data-notice">
              {retained.knowledgeLimitation}{" "}
              {
                retained.assessments.filter(
                  (item) => item.coverage === "not_assessed",
                ).length
              }{" "}
              retained records are not assessed. No alert does not establish
              safety. Return to the dataset to inspect all activity.
            </p>
          )}
          {run.warnings
            .filter(
              (w) =>
                w.code === "incomplete_data" ||
                w.code === "card_pattern_unavailable",
            )
            .map((w) => (
              <p key={w.code} className="data-notice">
                {assessmentText(w.message)}
              </p>
            ))}
          <p>
            These totals cover the entire completed simulation, independently of
            playback.
          </p>
          <dl className="facts">
            {(["approve", "review", "block"] as const).map((d) => (
              <div key={d}>
                <dt>{decisionLabel(d)}</dt>
                <dd>
                  {retained ? (
                    retained.assessments.filter(
                      (item) =>
                        item.recommendation.replaceAll("_", " ") ===
                        decisionLabel(d),
                    ).length
                  ) : (
                    <>
                      {m.decisions[d]!.count} ·{" "}
                      {money(m.decisions[d]!.amountMinor)}
                      <small>{rate(m.decisionRates[d]!)}</small>
                    </>
                  )}
                </dd>
              </div>
            ))}
            <div>
              <dt>Flagged</dt>
              <dd>{rate(m.flaggedRate)}</dd>
            </div>
            <div>
              <dt>Review workload</dt>
              <dd>{m.reviewWorkload} payments</dd>
            </div>
          </dl>
          {!isLearnedEngine(run.engineVersion) && (
            <details>
              <summary>Score distribution &amp; rule triggers</summary>
              <dl className="facts">
                {Object.entries(m.scoreBins).map(([bin, count]) => (
                  <div key={bin}>
                    <dt>Score {bin}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
                {Object.entries(m.ruleTriggerCounts).map(([rule, count]) => (
                  <div key={rule}>
                    <dt>{title(rule)}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {!retained && (
            <>
              <details open>
                <summary>
                  Synthetic truth · {m.labeledCount}/{m.totalCount} labeled
                </summary>
                <p>
                  {m.unlabeledCount} unlabeled payments are excluded from truth
                  and labeled cost metrics. Review means pending, not prevented
                  fraud.
                </p>
                {m.truthMetrics ? (
                  <dl className="facts">
                    {(
                      [
                        "fraudulent",
                        "legitimate",
                        "blockedFraud",
                        "approvedFraud",
                        "pendingFraud",
                        "blockedLegitimate",
                      ] as const
                    ).map((key) => (
                      <div key={key}>
                        <dt>
                          {key.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)}
                        </dt>
                        <dd>
                          {m.truthMetrics![key].count} ·{" "}
                          {money(m.truthMetrics![key].amountMinor)}
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt>Fraud block rate</dt>
                      <dd>{rate(m.truthMetrics.fraudBlockRate)}</dd>
                    </div>
                    <div>
                      <dt>Fraud approval rate</dt>
                      <dd>{rate(m.truthMetrics.fraudApprovalRate)}</dd>
                    </div>
                    <div>
                      <dt>Legitimate block rate</dt>
                      <dd>{rate(m.truthMetrics.legitimateBlockRate)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p>Truth metrics: N/A — no labeled payments.</p>
                )}
              </details>
              <details>
                <summary>
                  Illustrative costs ·{" "}
                  {amount(m.costs.illustrativeLabeledTotalCostMinor)}
                </summary>
                <dl className="facts">
                  <div>
                    <dt>Approved fraud loss (labeled)</dt>
                    <dd>{amount(m.costs.estimatedApprovedFraudLossMinor)}</dd>
                  </div>
                  <div>
                    <dt>Review cost (labeled)</dt>
                    <dd>{amount(m.costs.labeledReviewCostMinor)}</dd>
                  </div>
                  <div>
                    <dt>False-block friction (labeled)</dt>
                    <dd>
                      {amount(m.costs.estimatedFalseBlockFrictionCostMinor)}
                    </dd>
                  </div>
                  <div>
                    <dt>Review operating cost (all)</dt>
                    <dd>{money(m.costs.reviewOperatingCostAllMinor)}</dd>
                  </div>
                </dl>
                <p>
                  Assumptions:{" "}
                  {money(run.scenarioSnapshot.costAssumptions.reviewCostMinor)}{" "}
                  per review;{" "}
                  {money(
                    run.scenarioSnapshot.costAssumptions.falseBlockCostMinor,
                  )}{" "}
                  per false block;{" "}
                  {run.scenarioSnapshot.costAssumptions.approvedFraudLossBps /
                    100}
                  % approved fraud loss. All-review operating cost is separate
                  from the labeled total.
                </p>
              </details>
            </>
          )}
          <details>
            <summary>Model notes &amp; run information</summary>
            {run.events.length > 60 && (
              <p>
                Playback accelerates with the number of payments. This run takes
                about {Math.ceil(end / 1250)} seconds at 1×. Every payment is
                evaluated using the full available history and can be inspected
                in Inspect payments.
              </p>
            )}
            {run.warnings.map((w) => (
              <p key={w.code}>{assessmentText(w.message)}</p>
            ))}
            <p>
              Completed {run.completedAt}
              <br />
              Run {run.runId}
            </p>
            <p>
              {retained
                ? "This assessment is saved. Open its dataset to retrieve it after refresh. The graph layout and playback clock do not change the recorded assessment."
                : "Imported data and results last for this session. Refreshing clears the workspace and replay history."}
            </p>
          </details>
        </aside>
      )}
      <div className="status" role="status" aria-live="polite">
        {position.cursor >= 0 && !position.completed && (
          <>
            <button
              className={`revealed-decision decision-${run.events[position.cursor]!.decision}`}
              onClick={() => inspectPayment(position.cursor)}
            >
              Payment {sourceId(run.events[position.cursor]!.eventId)} ·{" "}
              {outcome(run.events[position.cursor]!)} ·{" "}
              {score(run.events[position.cursor]!)}
            </button>
            <br />
          </>
        )}
        {position.completed ? (
          <>
            <strong>Run complete · {m.totalCount} payments</strong>
            <br />
            {retained ? (
              "Investigation signals only · no payment actions taken"
            ) : (
              <>
                {m.decisions.approve!.count}{" "}
                {isLearnedEngine(run.engineVersion) ? "no alert" : "approved"} ·{" "}
                {m.decisions.review!.count} for review ·{" "}
                {m.decisions.block!.count} blocked
              </>
            )}
          </>
        ) : (
          <>
            {position.cursor + 1}/{run.events.length} revealed ·{" "}
            {current ? `${current.occurredAt} · UTC` : "Ready to replay"}
          </>
        )}
      </div>
      <footer className="bottom-bar">
        <div className="draft-label">
          {retained ? "Saved assessment" : "Run snapshot"}{" "}
          <span>
            ·{" "}
            {isLearnedEngine(run.engineVersion)
              ? run.events.some((e) => e.model?.probabilityAvailable)
                ? "Estimated fraud probabilities"
                : "Uncalibrated scores"
              : retained
                ? "Retrospective rules · not fraud probability"
                : "Synthetic model"}
          </span>
        </div>
        <nav className="tools playback" aria-label="Playback controls">
          <button onClick={state.edit}>
            {retained ? "Back to dataset" : "Edit scenario"}
          </button>
          <button
            aria-label="Previous event"
            disabled={position.cursor < 0}
            onClick={() => seek(position.cursor - 1)}
          >
            Previous
          </button>
          <button
            onClick={() =>
              state.playing
                ? useSimulation.setState({ playing: false })
                : play()
            }
          >
            {state.playing
              ? "Pause"
              : position.completed
                ? "Play again"
                : "Play"}
          </button>
          <button
            aria-label="Next event"
            disabled={!schedule.length || position.completed}
            onClick={() => seek(position.cursor + 1)}
          >
            Next
          </button>
          <button onClick={() => play(true)}>Replay</button>
          <button onClick={() => seek(-1)}>Reset playback</button>
          <label className="playback-speed">
            <span>
              Speed <strong>{state.speed}×</strong>
            </span>
            <input
              aria-label="Playback speed"
              type="range"
              min={0}
              max={PLAYBACK_SPEEDS.length - 1}
              step={1}
              value={PLAYBACK_SPEEDS.indexOf(state.speed)}
              aria-valuetext={`${state.speed}×`}
              onChange={(e) =>
                useSimulation.setState({
                  speed: PLAYBACK_SPEEDS[Number(e.target.value)]!,
                })
              }
            />
            <span className="speed-ticks" aria-hidden="true">
              {PLAYBACK_SPEEDS.map((speed) => (
                <span key={speed}>{speed}×</span>
              ))}
            </span>
          </label>
        </nav>
        <div className="tools camera">
          <button
            onClick={() => void flow.fitView({ padding: 0.25, duration: 0 })}
          >
            Fit
          </button>
        </div>
      </footer>
    </main>
  );
}
