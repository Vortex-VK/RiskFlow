import { useMemo } from "react";
import type { components } from "../../api/generated";
import type { DeepReadonly } from "../../domain/runs";
import { summarizeReview, reviewContext } from "../../domain/review";
import { RunInsights } from "./RunInsights";
import type { ReviewGroup } from "../../domain/runInsights";
import type { Scenario } from "../../domain/types";
import { money } from "../../domain/types";

type Event = DeepReadonly<components["schemas"]["EventResult"]>;
const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

export function DatasetResults({
  events,
  truth,
  threshold,
  inspectFlagged,
  scenario,
  inspectGroup,
  queueCapacity,
}: {
  events: readonly Event[];
  truth: Readonly<Record<string, string>>;
  threshold: number | null;
  queueCapacity?: number | undefined;
  inspectFlagged: () => void;
  scenario: Scenario;
  inspectGroup: (group: ReviewGroup) => void;
}) {
  const result = useMemo(
    () => summarizeReview(events, truth, threshold),
    [events, truth, threshold],
  );
  const context = useMemo(
    () => reviewContext(events, threshold),
    [events, threshold],
  );
  const total = events.length;
  const maxBin = Math.max(1, ...result.bins);
  return (
    <section className="dataset-results" aria-label="Dataset results">
      <p className="result-scope">
        Entire dataset ·{" "}
        {queueCapacity !== undefined
          ? `Top ${queueCapacity} across this upload`
          : threshold === null
            ? "Recorded review policy"
            : `${threshold}% threshold preview`}
      </p>
      <div className="result-grid">
        <div className="result-review">
          <strong>{result.reviews.toLocaleString()}</strong>
          <span>need review</span>
          <small>
            {percent(total ? result.reviews / total : null)} of{" "}
            {total.toLocaleString()} payments
          </small>
        </div>
        <div>
          <strong>{(total - result.reviews).toLocaleString()}</strong>
          <span>no alert</span>
          <small>
            {percent(total ? (total - result.reviews) / total : null)} stay
            outside the review queue
          </small>
        </div>
        <div className="result-review">
          <strong>{money(result.reviewAmount)}</strong>
          <span>value flagged</span>
          <small>
            {percent(
              result.totalAmount
                ? result.reviewAmount / result.totalAmount
                : null,
            )}{" "}
            of payment value
          </small>
        </div>
        <div>
          <strong>{money(result.totalAmount)}</strong>
          <span>total payment value</span>
          <small>{total.toLocaleString()} payments assessed</small>
        </div>
      </div>
      <button
        className="wide"
        disabled={!result.reviews}
        onClick={inspectFlagged}
      >
        Inspect {result.reviews.toLocaleString()} flagged payments
      </button>
      <RunInsights
        events={events}
        scenario={scenario}
        threshold={threshold}
        inspectGroup={inspectGroup}
      />
      {!!context.historyAssessed && (
        <section aria-label="Review context" className="review-context">
          {events.some((e) => e.model?.ranking) && (
            <p>
              Review follows the current upload queue. Capacity changes the
              selection, not the scores. No alert does not establish safety.
            </p>
          )}
          <h3>Available purchase history</h3>
          <dl className="facts">
            <div>
              <dt>Payments with no prior purchase history</dt>
              <dd>{context.noHistory}</dd>
            </div>
            <div>
              <dt>Payments with fewer than 10 prior purchases</dt>
              <dd>{context.shortHistory}</dd>
            </div>
          </dl>
          <p className="fineprint">
            History counts use earlier purchase observations available to this
            assessment. Limited history describes available context, not a fraud
            finding.
          </p>
        </section>
      )}
      {result.bins.some(Boolean) && (
        <section
          aria-label="Probability distribution"
          className="result-distribution"
        >
          <h3>Probability distribution</h3>
          {result.bins.map((count, i) => (
            <div key={i} className="distribution-row">
              <span>
                {i * 20}–{i === 4 ? "100" : `<${(i + 1) * 20}`}%
              </span>
              <div aria-hidden="true">
                <i style={{ width: `${(100 * count) / maxBin}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </section>
      )}
      <h3>
        {result.labeled ? "Detection on supplied labels" : "Outcome labels"}
      </h3>
      {result.labeled ? (
        <>
          <p className="result-scope">
            {result.labeled.toLocaleString()} of {total.toLocaleString()}{" "}
            payments labeled. Metrics compare with supplied outcomes, not with
            the model’s own predictions.
          </p>
          <div className="result-grid result-detection">
            {result.tp + result.fn > 0 && (
              <>
                <div>
                  <strong>{result.tp}</strong>
                  <span>frauds found</span>
                  <small>
                    {result.tp} of {result.tp + result.fn} labeled frauds
                    flagged
                  </small>
                </div>
                <div className="result-review">
                  <strong>{result.fn}</strong>
                  <span>frauds missed</span>
                  <small>Labeled frauds outside the review queue</small>
                </div>
              </>
            )}
            {result.fp + result.tn > 0 && (
              <>
                <div className="result-review">
                  <strong>{result.fp}</strong>
                  <span>false alerts</span>
                  <small>Legitimate payments sent for review</small>
                </div>
                <div>
                  <strong>{result.tn}</strong>
                  <span>correctly unflagged</span>
                  <small>Legitimate payments with no alert</small>
                </div>
              </>
            )}
          </div>
          <dl className="result-rates">
            {result.precision !== null && (
              <div>
                <dt>Precision</dt>
                <dd>{percent(result.precision)}</dd>
                <dd className="result-interpretation">
                  <small>
                    {result.tp + result.fp
                      ? `${result.tp} of ${result.tp + result.fp} labeled alerts are fraud`
                      : "No labeled alerts to evaluate"}
                  </small>
                </dd>
              </div>
            )}
            {result.recall !== null && (
              <div>
                <dt>Recall</dt>
                <dd>{percent(result.recall)}</dd>
                <dd className="result-interpretation">
                  <small>
                    {result.tp + result.fn
                      ? `${result.tp} of ${result.tp + result.fn} labeled frauds found`
                      : "No labeled frauds to evaluate"}
                  </small>
                </dd>
              </div>
            )}
          </dl>
          {result.precision === null && (
            <p className="metric-note">
              No labeled payments were flagged, so precision cannot be assessed.
            </p>
          )}
          {result.recall === null && (
            <p className="metric-note">
              No fraudulent labels were supplied, so recall cannot be assessed.
            </p>
          )}
          {result.labeled < total && (
            <p className="result-scope">
              {total - result.labeled} unlabeled payments excluded from
              detection metrics.
            </p>
          )}
        </>
      ) : (
        <p>
          No outcome labels supplied. Review workload and flagged value are
          measurable; fraud caught, false alerts, precision and recall require
          independently known outcomes.
        </p>
      )}
    </section>
  );
}
