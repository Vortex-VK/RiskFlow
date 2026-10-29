import { PaymentEvidence, AssessmentScope } from "./PaymentEvidence";
import { panelDuration } from "../Presence";
import { CloseIcon } from "../CloseIcon";
import { isLearnedEngine } from "../../domain/model";
import {
  recentTransactionGlows,
  TRANSACTION_GLOW_DURATION,
} from "../graph/growth";
import { useReducedMotion } from "../useReducedMotion";
import { PaymentPages } from "../PaymentPages";
import { CardPatternDetails } from "../CardPatternDetails";
import { ContinuousScores } from "../ContinuousScores";
import type { ReviewGroup } from "../../domain/runInsights";
import { DatasetResults } from "./DatasetResults";
import { ReviewCapacity } from "./ReviewCapacity";
import { rankedQueue, applyCapacity } from "../../domain/reviewQueue";
import { ProbabilityThreshold } from "./ProbabilityThreshold";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { needsReview, reviewIds } from "../../domain/review";
import "./replay.css";

const title = (value: string) => value.replaceAll("_", " ");
const noAction = () => {};

function OverviewCount({
  value,
  width,
  label,
}: {
  value: number;
  width: number;
  label: string;
}) {
  return (
    <span className="overview-metric">
      <span className="overview-reserve" aria-hidden="true">
        <span
          className="overview-number-reserve"
          style={{ inlineSize: `${width}ch` }}
        />
        <span>{label}</span>
      </span>
      <span className="overview-value">
        <strong>{value.toLocaleString()}</strong>{" "}
        <span>{label}</span>
      </span>
    </span>
  );
}

export function Replay({
  captured,
  openSamples,
}: {
  captured: CapturedRun;
  openSamples: () => void;
}) {
  const state = useSimulation();
  const [overviewMotion, setOverviewMotion] = useState<
    "entering" | "idle" | "exiting"
  >("entering");
  useEffect(() => {
    if (overviewMotion === "idle") return;
    // The fallback also handles disabled animations and background tabs.
    const duration =
      overviewMotion === "entering"
        ? panelDuration()
        : Math.min(280, panelDuration());
    const timer = setTimeout(() => {
      if (overviewMotion === "exiting") useSimulation.getState().edit();
      else setOverviewMotion("idle");
    }, duration);
    return () => clearTimeout(timer);
  }, [overviewMotion]);
  function exitSimulation() {
    useSimulation.setState({ playing: false });
    if (!panelDuration()) state.edit();
    else setOverviewMotion("exiting");
  }
  const flow = useReactFlow();
  const document = useMemo(
    () => decodeDocument(structuredClone(captured.document)),
    [captured],
  );
  const original = captured.result;
  const overviewCountWidth = original.events.length.toLocaleString().length;
  const stack = original.engineVersion === "engine-ml-stack-d5";
  const sourceIds = useMemo(
    () =>
      new Map(
        document.scenario.payments.map((p) => [
          p.id,
          p.rankingInput?.sourcePaymentId ?? p.id,
        ]),
      ),
    [document],
  );
  const queue = useMemo(
    () => rankedQueue(original.events, sourceIds),
    [original, sourceIds],
  );
  const [capacityOverride, setCapacityOverride] = useState<{
    runId: string;
    count: number;
  } | null>(null);
  const manual =
    capacityOverride?.runId === original.runId ? capacityOverride.count : null;
  const capacity = Math.max(
    0,
    Math.min(queue.ordered.length, manual ?? queue.suggestion.count),
  );
  const run = useMemo(
    () =>
      stack
        ? {
            ...original,
            events: applyCapacity(original.events, queue.ranks, capacity),
          }
        : original,
    [original, stack, queue, capacity],
  );
  const [probabilityThreshold, setThreshold] = useState(90);
  const threshold =
    run.engineVersion === "engine-ml-stack-d5" ? null : probabilityThreshold;
  const probabilityScores = useMemo(
    () =>
      run.events.flatMap((e) =>
        e.model?.score?.probabilityAvailable ? [e.model.score] : [],
      ),
    [run],
  );
  const retained = captured.assessment;
  const assessments = useMemo(
    () => new Map(retained?.assessments.map((item) => [item.eventId, item])),
    [retained],
  );
  const sourceId = (id: string) => assessments.get(id)?.sourceEventId ?? id;
  const outcome = (event: (typeof run.events)[number]) =>
    event.model
      ? needsReview(event, threshold)
        ? "review"
        : "no alert"
      : retained
        ? (
            assessments.get(event.eventId)?.recommendation ?? "not_assessed"
          ).replaceAll("_", " ")
        : event.decision;
  const score = (event: (typeof run.events)[number]) =>
    event.model
      ? event.model.ranking
        ? `#${queue.ranks.get(event.eventId)} of ${queue.ordered.length}`
        : event.model.score
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
  const [selection, setSelection] = useState<Selection>(null);
  const [evidenceIds, setEvidenceIds] = useState<readonly string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [reviewGroup, setReviewGroup] = useState<ReviewGroup | null>(null);
  const inspectReviewGroup = useCallback((group: ReviewGroup) => {
    useSimulation.setState({ playing: false });
    setReviewGroup(group);
    setFlaggedOnly(true);
    setPanel("events");
  }, []);
  const revealed = useMemo(
    () => run.events.slice(0, position.cursor + 1),
    [run, position.cursor],
  );
  // Present decisions only after their visible transaction has finished.
  // The inspector and results panel still read the immutable completed run.
  const flaggedIds = useMemo(
    () => reviewIds(revealed, threshold),
    [revealed, threshold],
  );
  const flaggedEvents = useMemo(
    () =>
      run.events
        .filter((e) => needsReview(e, threshold))
        .sort(
          (a, b) =>
            (queue.ranks.get(a.eventId) ?? Number.MAX_SAFE_INTEGER) -
              (queue.ranks.get(b.eventId) ?? Number.MAX_SAFE_INTEGER) ||
            (b.model?.score?.value ?? b.riskScore ?? 0) -
              (a.model?.score?.value ?? a.riskScore ?? 0) ||
            a.sequenceIndex - b.sequenceIndex,
        ),
    [run, threshold, queue.ranks],
  );
  const graphDecisions = useMemo(
    () =>
      revealed.map((e) => ({
        ...e,
        decision: e.model
          ? needsReview(e, threshold)
            ? "review"
            : "approve"
          : e.decision,
      })),
    [revealed, threshold],
  );
  const paymentEvents = useMemo(() => {
    if (reviewGroup) {
      const ids = new Set(reviewGroup.eventIds);
      return flaggedEvents.filter(
        (e) =>
          ids.has(e.eventId) &&
          (!reviewGroup.visibleOnly || flaggedIds.has(e.eventId)),
      );
    }
    return flaggedOnly ? flaggedEvents : run.events;
  }, [reviewGroup, flaggedOnly, flaggedEvents, flaggedIds, run.events]);
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
  const reducedMotion = useReducedMotion();
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
  const pulses = reducedMotion
    ? []
    : recentTransactionGlows(
        schedule,
        state.elapsed + (position.completed ? afterglow : 0),
      ).map((p) => ({
        eventId: run.events[p.index]!.eventId,
        progress: p.progress,
      }));

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanel(null);
      setEvidenceIds([]);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

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

  function inspectPayment(index: number) {
    useSimulation.setState({ playing: false });
    setSelected(index);
    setEvidenceIds([]);
    setPanel("event");
  }
  function nextFlagged() {
    const next =
      flaggedEvents.find((e) => e.sequenceIndex > selected) || flaggedEvents[0];
    if (next) inspectPayment(next.sequenceIndex);
  }
  function play() {
    setPanel(null);
    setEvidenceIds([]);
    useSimulation.setState({
      playing: true,
      ...(position.completed ? { elapsed: 0 } : {}),
    });
  }
  const inspect = (s: Selection) => {
    if (s?.kind === "payment") {
      const index = run.events.findIndex((e) => e.eventId === s.id);
      if (index >= 0) inspectPayment(index);
      return;
    }
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
    ? (flaggedOnly ? flaggedEvents : run.events).filter((e) =>
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
  return (
    <main
      className={`workspace replay ${panel ? "panel-open" : ""} ${flaggedOnly ? "flagged-only" : ""}`}
      aria-label="RiskFlow run snapshot"
    >
      <Graph
        key={run.runId}
        snapshot={document}
        add={noAction}
        inspect={inspect}
        revealedIds={revealedIds}
        decisions={graphDecisions}
        flaggedIds={flaggedIds}
        flaggedOnly={flaggedOnly}
        inspectReviewGroup={inspectReviewGroup}
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
        <div className="top-actions" data-mode-transition={overviewMotion}>
          <button
            className={`samples-button${overviewMotion === "exiting" ? " primary" : ""}`}
            data-tour="samples"
            aria-haspopup="dialog"
            onClick={() => {
              useSimulation.setState({ playing: false });
              openSamples();
            }}
          >
            Samples
          </button>
          <button
            aria-expanded={panel === "events"}
            aria-controls="run-payments"
            onClick={() => {
              useSimulation.setState({ playing: false });
              setReviewGroup(null);
              setPanel(panel === "events" ? null : "events");
            }}
          >
            Inspect payments
          </button>
          <button
            className={`results-button${overviewMotion !== "exiting" ? " primary" : ""}`}
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
      <section
        className={`run-overview is-${overviewMotion}${probabilityScores.length || stack ? " has-threshold" : ""}`}
        aria-label="Run assessment summary"
      >
        <div className="overview-counts">
          <div>
            <OverviewCount
              value={revealed.length}
              width={overviewCountWidth}
              label="assessed"
            />
          </div>
          <button
            className="review-total"
            aria-expanded={panel === "events" && flaggedOnly && !reviewGroup}
            aria-controls="run-payments"
            disabled={!flaggedIds.size}
            onClick={() => {
              setReviewGroup(null);
              setFlaggedOnly(true);
              useSimulation.setState({ playing: false });
              setPanel("events");
            }}
            aria-label={`${flaggedIds.size.toLocaleString()} need review — inspect flagged payments`}
          >
            <OverviewCount
              value={flaggedIds.size}
              width={overviewCountWidth}
              label="need review"
            />
          </button>
          <div className="no-alert-total">
            <OverviewCount
              value={revealed.length - flaggedIds.size}
              width={overviewCountWidth}
              label="no alert"
            />
          </div>
          <button
            className="flagged-filter"
            aria-pressed={flaggedOnly}
            onClick={() => {
              setReviewGroup(null);
              setFlaggedOnly(!flaggedOnly);
            }}
          >
            Flagged only
          </button>
        </div>
        {stack && (
          <ReviewCapacity
            count={capacity}
            total={queue.ordered.length}
            suggestion={queue.suggestion}
            onChange={(count) =>
              setCapacityOverride(
                count === null ? null : { runId: original.runId, count },
              )
            }
          />
        )}
        {!!probabilityScores.length && (
          <ProbabilityThreshold
            threshold={probabilityThreshold}
            onChange={setThreshold}
          />
        )}
      </section>
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
          <h2>
            {reviewGroup?.label ??
              (flaggedOnly ? "Payments for review" : "Payments")}
          </h2>
          <p>
            Completed model results. Select a payment to inspect its evidence.
          </p>
          {!paymentEvents.length && (
            <p>No flagged payments match this selection.</p>
          )}
          <div className="event-list run-event-list">
            <PaymentPages
              key={reviewGroup?.label ?? (flaggedOnly ? "flagged" : "all")}
              items={paymentEvents}
              identify={(e) => sourceId(e.eventId)}
            >
              {(e) => (
                <button
                  key={e.eventId}
                  className={`payment-result decision-${e.decision} ${needsReview(e, threshold) ? "payment-needs-review" : ""}`}
                  aria-label={`Inspect ${sourceId(e.eventId)}`}
                  onClick={() => inspectPayment(e.sequenceIndex)}
                >
                  <span>{sourceId(e.eventId)}</span>
                  <strong>{money(e.amountMinor)}</strong>
                  <span>{outcome(e)}</span>
                  <span>{score(e)}</span>
                  {e.ruleEvaluations.some((r) => r.available === false) && (
                    <span>Limited data</span>
                  )}
                  {e.cardPattern && <span>Additional card review</span>}
                </button>
              )}
            </PaymentPages>
          </div>
        </section>
      )}
      {panel === "event" && event && (
        <aside
          className="card inspector run-inspector payment-explanation"
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
            {retained ? "Investigation recommendation" : "Selected payment"}
          </div>
          <h2>
            {sourceId(event.eventId)} · {money(event.amountMinor)}
          </h2>
          <div
            className={`decision decision-${event.decision} payment-verdict ${needsReview(event, threshold) ? "needs-review" : ""}`}
          >
            <span>
              {needsReview(event, threshold)
                ? "Review recommended"
                : outcome(event)}
            </span>
            <div className="payment-estimate">
              <strong>{score(event)}</strong>
              <span>
                {event.model?.ranking
                  ? "Review order"
                  : event.model?.score?.probabilityAvailable
                    ? "Estimated fraud probability"
                    : "Model score"}
              </span>
            </div>
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
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
              ...(event.model?.ranking?.timePrecision === "day"
                ? {}
                : ({
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  } as const)),
            }).format(new Date(event.occurredAt))}{" "}
            · UTC
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
            <PaymentEvidence
              truth={run.scenarioSnapshot.groundTruth[event.eventId]}
              key={`${run.runId}:${event.eventId}`}
              scenario={document.scenario}
              event={event}
              threshold={threshold}
              queue={
                stack
                  ? {
                      rank: queue.ranks.get(event.eventId)!,
                      total: queue.ordered.length,
                      capacity,
                      comparison: queue.middle!,
                      reviewCutoff:
                        capacity > 0 ? queue.ordered[capacity - 1]! : null,
                    }
                  : undefined
              }
            />
          ) : (
            <p>
              Raw points {event.rawScore}
              {(event.rawScore ?? 0) > 100 ? " · capped at 100" : ""}. Review ≥{" "}
              {run.scenarioSnapshot.policy.reviewThreshold};{" "}
              {retained ? "high priority" : "block"} ≥{" "}
              {run.scenarioSnapshot.policy.blockThreshold}.
            </p>
          )}
          {event.cardScores && (
            <details>
              <summary>Additional card model scores</summary>
              <ContinuousScores
                model={event.model}
                cards={event.cardScores}
                includePrimary={false}
              />
            </details>
          )}
          {event.cardPattern && (
            <details>
              <summary>Additional card review</summary>
              <CardPatternDetails review={event.cardPattern} />
            </details>
          )}
          {!!event.ruleEvaluations.length && (
            <details>
              <summary>Rule measurements &amp; evidence</summary>
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
                              key.replace(
                                /[A-Z]/g,
                                (c) => ` ${c.toLowerCase()}`,
                              ),
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
                          onClick={() =>
                            setEvidenceIds(rule.evidence.eventIds!)
                          }
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
            </details>
          )}
          {!event.model && (
            <details>
              <summary>Assessment scope</summary>
              <AssessmentScope
                truth={run.scenarioSnapshot.groundTruth[event.eventId]}
              />
            </details>
          )}
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
          <h3>{related.length} recorded payments</h3>
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
                className="wide payment-review-choice"
                data-review-state={
                  needsReview(e, threshold)
                    ? "review"
                    : outcome(e) === "no alert"
                      ? "no-alert"
                      : "pending"
                }
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
          <DatasetResults
            scenario={document.scenario}
            inspectGroup={(group) => {
              useSimulation.setState({ playing: false });
              setFlaggedOnly(true);
              setReviewGroup(group);
              setPanel("events");
            }}
            queueCapacity={stack ? capacity : undefined}
            events={run.events}
            truth={run.scenarioSnapshot.groundTruth}
            threshold={threshold}
            inspectFlagged={() => {
              setReviewGroup(null);
              setFlaggedOnly(true);
              setPanel("events");
            }}
          />
          {retained && (
            <p className="result-scope">
              {
                retained.assessments.filter(
                  (item) => item.coverage === "not_assessed",
                ).length
              }{" "}
              retained records not assessed.
            </p>
          )}
        </aside>
      )}
      <div className="status" role="status" aria-live="polite">
        {position.cursor >= 0 && !position.completed && !event && (
          <>
            Payment {sourceId(run.events[position.cursor]!.eventId)} {"\u00b7"}{" "}
            {outcome(run.events[position.cursor]!)}
            <br />
          </>
        )}
        {position.completed ? (
          <>
            <strong>Run complete · {m.totalCount} payments</strong>
            <br />
            {run.events.length - flaggedEvents.length} no alert {"\u00b7"}{" "}
            {flaggedEvents.length} for review
            {threshold !== null && " \u00b7 Threshold preview"}
          </>
        ) : (
          <>
            {position.cursor + 1}/{run.events.length} revealed ·{" "}
            {current ? `${current.occurredAt} · UTC` : "Ready to replay"}
          </>
        )}
      </div>
      <footer className="bottom-bar">
        <nav className="tools playback" aria-label="Playback controls">
          <button
            onClick={exitSimulation}
            disabled={overviewMotion === "exiting"}
          >
            {retained ? "Back to dataset" : "Edit scenario"}
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
          {!!flaggedEvents.length && (
            <button className="next-flagged" onClick={nextFlagged}>
              Next flagged
            </button>
          )}
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
      </footer>
    </main>
  );
}
