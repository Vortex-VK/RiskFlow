import { useEffect, useState } from "react";
import type { DeepReadonly, EventResult } from "../../domain/runs";
import type { Scenario } from "../../domain/types";
import { merchantCategoryName } from "../../domain/merchantCategories";
import {
  fetchStackComparison,
  type StackComparison,
  type ComparativeCheck,
} from "../../api/stackComparison";
import {
  fetchStackExplanation,
  type StackExplanation,
} from "../../api/stackExplanation";
import {
  observedRanking,
  rankingLabels,
  priorityComparison,
  formatPoints,
  checkPointBreakdown,
  rankingFact,
} from "../../domain/rankingExplanation";

export type QueueContext = {
  rank: number;
  total: number;
  capacity: number;
  comparison: DeepReadonly<EventResult>;
  reviewCutoff: DeepReadonly<EventResult> | null;
};
const cache = new WeakMap<Scenario, Map<string, StackExplanation>>();
const comparisonCache = new WeakMap<Scenario, Map<string, StackComparison>>();
const pointColor = (points: number) =>
  points > 0 ? "raises-risk" : points < 0 ? "lowers-risk" : "probability-start";
function ExpertFactors({
  check,
  rows,
  scale,
}: {
  check: ComparativeCheck;
  rows: ReturnType<typeof checkPointBreakdown>["rows"];
  scale: number;
}) {
  const label = rankingLabels[check.feature] ?? check.feature;
  return (
    <div
      className="check-contributions"
      role="group"
      aria-label={`${label} observations`}
    >
      <div className="contribution-columns" aria-hidden="true">
        <span>Observation</span>
        <span className="contribution-axis">
          <span>−</span>
          <span>0</span>
          <span>+</span>
        </span>
        <span>Points</span>
      </div>
      <ul className="contribution-rows">
        {[...rows]
          .sort((a, b) =>
            a.feature === "other_context"
              ? 1
              : b.feature === "other_context"
                ? -1
                : Math.abs(b.points) - Math.abs(a.points) ||
                  a.feature.localeCompare(b.feature),
          )
          .map((row) => {
            const name =
              row.feature === "other_context"
                ? "Other context"
                : (rankingLabels[row.feature] ??
                  row.feature.replaceAll("_", " "));
            const width = (Math.abs(row.points) / scale) * 50;
            const content = (
              <>
                <span className="contribution-observation">
                  <span className="observation-name">{name}</span>
                  {row.feature !== "other_context" && (
                    <strong>{observedRanking(row.feature, row.value)}</strong>
                  )}
                  {row.feature === "category" &&
                    merchantCategoryName(row.value) && (
                      <small className="merchant-code">{row.value}</small>
                    )}
                </span>
                <span className="contribution-track" aria-hidden="true">
                  <span
                    className="contribution-fill"
                    style={{
                      left: `${row.points < 0 ? 50 - width : 50}%`,
                      width: `${width}%`,
                    }}
                  />
                </span>
                <strong className="check-points">
                  {formatPoints(row.points, true)}
                </strong>
              </>
            );
            return (
              <li
                key={row.feature}
                data-observation={row.feature}
                className={`${pointColor(row.points)}${row.feature === "other_context" ? " other-context" : ""}`}
              >
                <div className="contribution-row">{content}</div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

export function StackEvidence({
  scenario,
  event,
  queue,
}: {
  scenario: Scenario;
  event: DeepReadonly<EventResult>;
  queue: QueueContext;
}) {
  const [details, setDetails] = useState<{
    data: StackExplanation;
    breakdown: ReturnType<typeof priorityComparison>;
    comparison: StackComparison;
  }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const comparison = queue.comparison;
  useEffect(() => {
    if (details) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    const requests = new Map<string, Promise<StackExplanation>>();
    const getExplanation = (payment: DeepReadonly<EventResult>) => {
      const cached = cache.get(scenario)?.get(payment.eventId);
      if (cached) return Promise.resolve(cached);
      let request = requests.get(payment.eventId);
      if (!request) {
        request = fetchStackExplanation(scenario, payment, signal).then(
          (result) => {
            if (!controller.signal.aborted) {
              const entries =
                cache.get(scenario) ?? new Map<string, StackExplanation>();
              if (entries.size >= 30)
                entries.delete(entries.keys().next().value!);
              entries.set(payment.eventId, result);
              cache.set(scenario, entries);
            }
            return result;
          },
        );
        requests.set(payment.eventId, request);
      }
      return request;
    };
    void Promise.all([getExplanation(event), getExplanation(comparison)])
      .then(async ([data, reference]) => {
        if (controller.signal.aborted) return;
        const key = JSON.stringify([data.eventId, reference.eventId]);
        const compared =
          comparisonCache.get(scenario)?.get(key) ??
          (await fetchStackComparison(scenario, data, reference, signal));
        if (controller.signal.aborted) return;
        const entries =
          comparisonCache.get(scenario) ?? new Map<string, StackComparison>();
        if (entries.size >= 30) entries.delete(entries.keys().next().value!);
        entries.set(key, compared);
        comparisonCache.set(scenario, entries);
        setDetails({
          data,
          breakdown: priorityComparison(data, reference),
          comparison: compared,
        });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Explanation unavailable.",
          );
      });
    return () => controller.abort();
  }, [scenario, event, comparison, details, attempt]);
  const data = details?.data;
  const breakdown = details?.breakdown;
  const history = data?.contributions.find(
    (row) => row.feature === "p_log_history_n",
  )?.value;
  const historyCount =
    typeof history === "number" ? Math.round(Math.expm1(history)) : undefined;
  const checks =
    details?.comparison.checks.map((check) => ({
      check,
      rows: checkPointBreakdown(
        check,
        breakdown!.steps.find((step) => step.feature === check.feature)!,
      ).rows,
    })) ?? [];
  const contributionScale = Math.max(
    1,
    ...checks.flatMap((c) => c.rows.map((row) => Math.abs(row.points))),
  );
  const selectedColor =
    queue.rank <= queue.capacity
      ? "payment-score-review"
      : "payment-score-clear";
  // Use the same centered, tenth-of-a-point scale as the waterfall.
  const cutoff = queue.reviewCutoff
    ? Math.round(
        (queue.reviewCutoff.model!.ranking!.rawMargin -
          queue.comparison.model!.ranking!.rawMargin) *
          100,
      )
    : null;
  const rows = breakdown
    ? [
        ...breakdown.steps.map((s, i) => ({
          label: i === 4 ? "Other" : String(i + 1),
          from: s.from,
          to: s.to,
        })),
        { label: "Total", from: 0, to: breakdown.final },
      ]
    : [];
  const values = rows.flatMap((row) => [row.from, row.to]);
  const high = Math.max(
    100,
    Math.ceil(Math.max(0, ...values.map(Math.abs)) / 100) * 100,
  );
  const low = -high;
  const y = (points: number) => 16 + ((high - points) / (high - low)) * 136;
  // Leave a fixed right gutter for the cutoff value, clear of the Total bar.
  const plotRight = 290;
  const slot = (plotRight - 38) / Math.max(1, rows.length);
  const totalX = 38 + slot * (rows.length - 0.5);
  const cutoffY =
    cutoff !== null && cutoff >= low && cutoff <= high ? y(cutoff) : null;
  // Align with the mark, nudging inward only at the plot's top/bottom edges.
  const cutoffLabelY =
    cutoffY === null ? 0 : Math.max(25, Math.min(149, cutoffY + 3));
  const cutoffText = cutoff === null ? "" : formatPoints(cutoff, true);
  return (
    <section aria-label="Ranking evidence" className="stack-evidence">
      <p className="queue-decision">
        {queue.rank <= queue.capacity ? "Included in" : "Outside"} your review
        list
        {" · "}
        {queue.capacity} {queue.capacity === 1 ? "payment" : "payments"}
      </p>
      {error ? (
        <p role="status">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Retry
          </button>
        </p>
      ) : !data ? (
        <p role="status">Comparing payment scores…</p>
      ) : null}
      {data && (
        <>
          <dl className="facts stack-facts priority-comparison">
            <div>
              <dt>Priority score</dt>
              <dd className={`selected-priority-score ${selectedColor}`}>
                <strong>{formatPoints(breakdown!.final, true)} points</strong>
              </dd>
            </div>
          </dl>
          <dl className="facts stack-facts">
            {data.facts.slice(0, 2).map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  <strong>{fact.value}</strong>
                  {fact.label !== "At this merchant" && (
                    <small>{fact.comparison}</small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <figure
            className="probability-walkthrough compact-probability"
            aria-label="How checks change priority points"
            aria-description={
              cutoff === null
                ? "No payments selected for review."
                : `Review cutoff: ${formatPoints(cutoff, true)} points.${cutoffY === null ? " Outside the chart's visible range." : " The marker shows the last payment included in the review capacity."}`
            }
          >
            <figcaption>Priority score breakdown</figcaption>
            <svg
              className="probability-plot"
              viewBox="0 0 344 180"
              aria-hidden="true"
            >
              {[...new Set([low, Math.round((low + high) / 2), high])].map(
                (points) => (
                  <g key={points}>
                    <line
                      className={points === 0 ? "plot-zero" : "plot-grid"}
                      x1={38}
                      x2={plotRight}
                      y1={y(points)}
                      y2={y(points)}
                    />
                    <text
                      className="plot-axis"
                      x={33}
                      y={y(points) + 3}
                      textAnchor="end"
                    >
                      {formatPoints(points, true)}
                    </text>
                  </g>
                ),
              )}
              {rows.map((row, i) => (
                <g
                  key={row.label}
                  className={
                    i === rows.length - 1
                      ? `priority-total ${selectedColor}`
                      : pointColor(row.to - row.from)
                  }
                >
                  {i > 0 && i < rows.length - 1 && (
                    <line
                      className="plot-connector"
                      x1={38 + slot * (i - 0.5) + 9}
                      x2={38 + slot * (i + 0.5) - 9}
                      y1={y(row.from)}
                      y2={y(row.from)}
                    />
                  )}
                  <rect
                    x={38 + slot * (i + 0.5) - (i === rows.length - 1 ? 11 : 9)}
                    y={Math.min(y(row.from), y(row.to))}
                    width={i === rows.length - 1 ? 22 : 18}
                    height={Math.abs(y(row.from) - y(row.to))}
                    rx={2}
                  />
                  <circle cx={38 + slot * (i + 0.5)} cy={y(row.to)} r={2} />
                  {i === rows.length - 1 && (
                    <line
                      className="priority-total-cap"
                      x1={totalX - 13}
                      x2={totalX + 13}
                      y1={y(row.to)}
                      y2={y(row.to)}
                    />
                  )}
                  <text
                    className="plot-axis"
                    x={38 + slot * (i + 0.5)}
                    y={172}
                    textAnchor="middle"
                  >
                    {row.label}
                  </text>
                </g>
              ))}
              {cutoff !== null && cutoffY !== null && (
                <g className="priority-review-cutoff" data-score={cutoff}>
                  <line
                    x1={totalX - 20}
                    x2={totalX + 20}
                    y1={cutoffY}
                    y2={cutoffY}
                  />
                  <text x={totalX + 26} y={cutoffLabelY} textAnchor="start">
                    {cutoffText}
                  </text>
                </g>
              )}
            </svg>
            <div className="priority-check-columns" aria-hidden="true">
              <span>Check</span>
              <span>Priority points</span>
            </div>
            <ol
              className="priority-check-list"
              aria-label="Priority point contributions"
            >
              {breakdown!.steps.map((step, i) => {
                const heading = (
                  <>
                    <strong>
                      {i < 4 ? `${i + 1}. ` : ""}
                      {rankingLabels[step.feature] ?? "Remaining factors"}
                    </strong>
                    <span className="priority-contribution">
                      {formatPoints(step.difference, true)}
                    </span>
                  </>
                );
                const check = checks.find(
                  (c) => c.check.feature === step.feature,
                );
                return (
                  <li
                    key={step.feature}
                    className={pointColor(step.difference)}
                  >
                    {check ? (
                      <details className="expert-observations">
                        <summary className="priority-check-heading">
                          {heading}
                        </summary>
                        <div className="priority-check-body">
                          <ExpertFactors
                            check={check.check}
                            rows={check.rows}
                            scale={contributionScale}
                          />
                        </div>
                      </details>
                    ) : step.feature === "other" ? (
                      <details className="remaining-factors">
                        <summary className="priority-check-heading">
                          {heading}
                        </summary>
                        <ul className="remaining-factor-list">
                          {breakdown!.remainingSteps
                            .filter((row) => row.difference !== 0)
                            .map((row) => (
                              <li
                                key={row.feature}
                                className={pointColor(row.difference)}
                              >
                                <span>
                                  {rankingLabels[row.feature] ??
                                    row.feature.replaceAll("_", " ")}
                                </span>
                                <strong>
                                  {formatPoints(row.difference, true)}
                                </strong>
                              </li>
                            ))}
                        </ul>
                        {!breakdown!.remainingSteps.some(
                          (row) => row.difference !== 0,
                        ) && (
                          <p className="remaining-empty">
                            No additional points.
                          </p>
                        )}
                      </details>
                    ) : (
                      <div className="priority-check-heading">{heading}</div>
                    )}
                    {i < 4 && !step.feature.startsWith("expert_") && (
                      <div className="priority-input-comparison">
                        {[
                          rankingFact(step.feature, step.value, historyCount)
                            .value,
                          rankingFact(step.feature, step.value, historyCount)
                            .context,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </figure>
        </>
      )}
    </section>
  );
}
