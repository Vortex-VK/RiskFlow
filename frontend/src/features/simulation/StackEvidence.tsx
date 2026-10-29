import { useEffect, useState } from "react";
import type { DeepReadonly, EventResult } from "../../domain/runs";
import type { Scenario } from "../../domain/types";
import {
  fetchStackExplanation,
  type StackExplanation,
} from "../../api/stackExplanation";
import {
  observedRanking,
  rankingLabels,
  rankingWalkthrough,
} from "../../domain/rankingExplanation";

export type QueueContext = {
  rank: number;
  total: number;
  capacity: number;
  rankAt: (score: number) => number;
};
const cache = new WeakMap<Scenario, Map<string, StackExplanation>>();

function ExpertFactors({
  data,
  feature,
}: {
  data: StackExplanation;
  feature: string;
}) {
  const expert = data.experts.find((e) => `expert_${e.expert}` === feature);
  if (!expert) return null;
  const strongest = [...expert.contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);
  return (
    <details className="expert-observations">
      <summary>Contributing observations</summary>
      <dl className="facts stack-facts">
        {strongest.map((row) => (
          <div key={row.feature}>
            <dt>
              {rankingLabels[row.feature] ?? row.feature.replaceAll("_", " ")}
            </dt>
            <dd>
              <strong>{observedRanking(row.feature, row.value)}</strong>
              <small>
                {row.contribution > 0 ? "Raises" : "Lowers"} this component's
                score
              </small>
            </dd>
          </div>
        ))}
      </dl>
      <p className="fineprint">
        Within this component; effects are not additive across models.
      </p>
    </details>
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
  const [data, setData] = useState(() =>
    cache.get(scenario)?.get(event.eventId),
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (data) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    void fetchStackExplanation(scenario, event, signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const entries =
          cache.get(scenario) ?? new Map<string, StackExplanation>();
        if (entries.size >= 30) entries.delete(entries.keys().next().value!);
        entries.set(event.eventId, result);
        cache.set(scenario, entries);
        setData(result);
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
  }, [scenario, event, data, attempt]);
  const breakdown = data ? rankingWalkthrough(data, queue.rankAt) : null;
  const rows = breakdown
    ? [
        { label: "Start", from: queue.total, to: breakdown.start },
        ...breakdown.steps.map((s, i) => ({
          label: i === 4 ? "Other" : String(i + 1),
          from: s.from,
          to: s.to,
        })),
        { label: "Final", from: queue.total, to: breakdown.final },
      ]
    : [];
  const y = (rank: number) =>
    16 + ((rank - 1) / Math.max(1, queue.total - 1)) * 136;
  const slot = 292 / Math.max(1, rows.length);
  return (
    <section aria-label="Ranking evidence" className="stack-evidence">
      <p className="queue-decision">
        {queue.rank <= queue.capacity ? "Inside" : "Outside"} your{" "}
        {queue.capacity}-payment queue
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
        <p role="status">Calculating contributing factors…</p>
      ) : null}
      {data && (
        <>
          <dl className="facts stack-facts">
            {data.facts.slice(0, 2).map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  <strong>{fact.value}</strong>
                  <small>{fact.comparison}</small>
                </dd>
              </div>
            ))}
          </dl>
          <figure
            className="probability-walkthrough compact-probability"
            aria-label="How inputs move review priority"
          >
            <figcaption>How priority builds</figcaption>
            <svg
              className="probability-plot"
              viewBox="0 0 344 180"
              aria-hidden="true"
            >
              {[...new Set([1, Math.ceil(queue.total / 2), queue.total])].map(
                (rank) => (
                  <g key={rank}>
                    <line
                      className="plot-grid"
                      x1={38}
                      x2={330}
                      y1={y(rank)}
                      y2={y(rank)}
                    />
                    <text
                      className="plot-axis"
                      x={33}
                      y={y(rank) + 3}
                      textAnchor="end"
                    >
                      #{rank}
                    </text>
                  </g>
                ),
              )}
              {rows.map((row, i) => (
                <g
                  key={row.label}
                  className={
                    i === 0
                      ? "probability-start"
                      : row.to < row.from
                        ? "raises-risk"
                        : "lowers-risk"
                  }
                >
                  {i > 0 && (
                    <line
                      className="plot-connector"
                      x1={38 + slot * (i - 0.5) + 9}
                      x2={38 + slot * (i + 0.5) - 9}
                      y1={y(row.from)}
                      y2={y(row.from)}
                    />
                  )}
                  <rect
                    x={38 + slot * (i + 0.5) - 9}
                    y={Math.min(y(row.from), y(row.to))}
                    width={18}
                    height={Math.max(1, Math.abs(y(row.from) - y(row.to)))}
                    rx={2}
                  />
                  <circle cx={38 + slot * (i + 0.5)} cy={y(row.to)} r={2} />
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
            </svg>
            <div className="probability-endpoints">
              <span>Starting position #{breakdown!.start}</span>
              <span>Final #{queue.rank}</span>
            </div>
            <ol className="contribution-list compact-contributions">
              {breakdown!.steps.map((step, i) => (
                <li
                  key={step.feature}
                  className={step.movement > 0 ? "raises-risk" : "lowers-risk"}
                >
                  <div>
                    <strong>
                      {i < 4 ? `${i + 1}. ` : ""}
                      {rankingLabels[step.feature] ?? "Other inputs"}
                    </strong>
                    <span className="contribution-value">
                      {Math.abs(step.movement)}{" "}
                      {step.movement > 0
                        ? "places up"
                        : step.movement < 0
                          ? "places down"
                          : "places"}
                    </span>
                  </div>
                  {i < 4 && (
                    <small>{observedRanking(step.feature, step.value)}</small>
                  )}
                  {i < 4 && (
                    <ExpertFactors data={data} feature={step.feature} />
                  )}
                </li>
              ))}
            </ol>
          </figure>
          <details>
            <summary>About these comparisons</summary>
            <dl className="facts stack-facts">
              {data.facts.slice(2).map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>
                    <strong>{fact.value}</strong>
                    <small>{fact.comparison}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Amounts use the geometric mean of earlier purchases in up to 100
              timestamp batches. Equal-time payments are excluded. Rank changes
              map verified model contributions onto this upload; step order
              affects their size. Component assessments are combined inputs, not
              individual fraud reasons.
            </p>
            <p>
              Starting position uses the model baseline, not a typical
              transaction. A high rank is not proof of fraud.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
