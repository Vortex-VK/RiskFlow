import type { PaymentExplanation } from "../../api/paymentExplanation";
import {
  probabilityWalkthrough,
  signedProbabilityPoints,
} from "../../domain/contributionBreakdown";
import { featureLabels, observedFeature } from "./explanationLabels";

export function ProbabilityPlot({
  data,
  cutoff,
  review,
  preview,
}: {
  data: PaymentExplanation;
  cutoff: number | undefined;
  review: boolean;
  preview: boolean;
}) {
  const b = probabilityWalkthrough(data);
  const rows = [
    {
      label: "Start",
      name: "Starting estimate",
      from: 0,
      to: b.start,
      value: b.start,
      kind: "probability-start",
    },
    ...b.steps.map((s, i) => ({
      ...s,
      label: s.label === "Other" ? "Other" : String(i + 1),
      name: featureLabels[s.feature] ?? s.feature,
      kind: s.value >= 0 ? "raises-risk" : "lowers-risk",
    })),
    {
      label: "Final",
      name: "Final estimate",
      from: 0,
      to: b.final,
      value: b.final,
      kind: review ? "raises-risk" : "lowers-risk",
    },
  ];
  const left = 30,
    right = 332,
    top = 12,
    bottom = 172;
  const y = (p: number) => bottom - (p / 100) * (bottom - top);
  const slot = (right - left) / rows.length;
  const x = (i: number) => left + slot * (i + 0.5);
  const width = Math.min(20, slot * 0.6);
  return (
    <figure
      className="probability-walkthrough compact-probability"
      aria-label="From starting estimate to final probability"
    >
      <figcaption>How the probability adds up</figcaption>
      <svg
        className="probability-plot"
        viewBox="0 0 344 196"
        aria-hidden="true"
      >
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line
              className="plot-grid"
              x1={left}
              x2={right}
              y1={y(p)}
              y2={y(p)}
            />
            <text
              className="plot-axis"
              x={left - 5}
              y={y(p) + 3}
              textAnchor="end"
            >
              {p}%
            </text>
          </g>
        ))}
        {rows.map((row, i) => (
          <g key={row.label} className={row.kind}>
            <title>
              {row.name}: {row.to.toFixed(b.precision)}% running estimate
            </title>
            {i > 0 && i < rows.length - 1 && (
              <line
                className="plot-connector"
                x1={x(i - 1) + width / 2}
                x2={x(i) - width / 2}
                y1={y(row.from)}
                y2={y(row.from)}
              />
            )}
            <rect
              x={x(i) - width / 2}
              y={y(Math.max(row.from, row.to))}
              width={width}
              height={Math.abs(y(row.from) - y(row.to))}
              rx="2"
            />
            <circle cx={x(i)} cy={y(row.to)} r="2" />
            <text className="plot-axis" x={x(i)} y={188} textAnchor="middle">
              {row.label}
            </text>
          </g>
        ))}
        {cutoff !== undefined && (
          <line
            className="probability-cutoff"
            data-threshold={cutoff}
            x1={left}
            x2={right}
            y1={y(cutoff)}
            y2={y(cutoff)}
          />
        )}
      </svg>
      <div className="probability-endpoints">
        <span>Start {b.start.toFixed(b.precision)}%</span>
        {cutoff !== undefined && (
          <span className="probability-boundary-label">
            Dashed: {cutoff.toFixed(2)}% {preview ? "threshold" : "cutoff"}
          </span>
        )}
      </div>
      <ol className="contribution-list compact-contributions">
        {b.visible.map((row, i) => {
          const step = b.steps[i]!;
          const observed = observedFeature(row.feature, row.value);
          return (
            <li
              key={row.feature}
              className={step.value >= 0 ? "raises-risk" : "lowers-risk"}
            >
              <div>
                <strong>
                  <span className="contribution-index">{i + 1}.</span>{" "}
                  {featureLabels[row.feature] ?? row.feature}
                </strong>
                <span
                  className="contribution-value"
                  title={`Running estimate: ${step.to.toFixed(b.precision)}%`}
                >
                  {signedProbabilityPoints(step.displayChange, b.precision)}
                </span>
              </div>
              {observed && (
                <small title={observed}>
                  {row.value === null
                    ? "Not available"
                    : row.feature.endsWith("_margin")
                      ? "Combined detector assessment"
                      : observed}
                </small>
              )}
            </li>
          );
        })}
      </ol>
      {!!b.omitted && (
        <details className="other-factor-details">
          <summary className={b.other >= 0 ? "raises-risk" : "lowers-risk"}>
            <span>Other {b.omitted} factors</span>
            <strong>
              {signedProbabilityPoints(
                b.steps.at(-1)!.displayChange,
                b.precision,
              )}
            </strong>
          </summary>
          <p className="fineprint">
            Continues from {b.otherSteps[0]!.from.toFixed(b.precision)}% to{" "}
            {b.otherSteps.at(-1)!.to.toFixed(b.precision)}%. The changes below
            add up to “Other”. A large grouped jump can reflect many
            contributions applied together through the nonlinear probability
            conversion, not their share of model importance.
          </p>
          <ol
            className="other-factor-list"
            aria-label="Other contributing factors"
          >
            {b.otherSteps.map((step) => {
              const observed = observedFeature(
                step.feature,
                step.observedValue,
              );
              return (
                <li
                  key={step.feature}
                  className={step.value >= 0 ? "raises-risk" : "lowers-risk"}
                >
                  <div className="other-factor-heading">
                    <strong>
                      {featureLabels[step.feature] ?? step.feature}
                    </strong>
                    <span className="other-factor-change">
                      {signedProbabilityPoints(step.displayChange, b.precision)}
                    </span>
                  </div>
                  {observed && (
                    <small>
                      {step.observedValue === null
                        ? "Not available"
                        : step.feature.endsWith("_margin")
                          ? "Combined detector assessment"
                          : observed}
                    </small>
                  )}
                  <div className="other-factor-running">
                    Running estimate{" "}
                    <span>{step.to.toFixed(b.precision)}%</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="fineprint">
            Listed by model-score contribution magnitude. Percentage-point steps
            depend on this order; expanding the list does not change the final
            estimate.
          </p>
        </details>
      )}
      <div
        className={`probability-final ${review ? "raises-risk" : "lowers-risk"}`}
      >
        <div className="probability-step-heading">
          <strong>Final estimate</strong>
          <strong>{b.final.toFixed(b.precision)}%</strong>
        </div>
        <p>
          {review ? "Review recommended" : "No alert"}
          {cutoff !== undefined && (
            <>
              {" "}
              · {Math.abs(b.final - cutoff).toFixed(2)}%{" "}
              {b.final >= cutoff ? "above" : "below"} the{" "}
              {preview ? "preview threshold" : "review cutoff"}
            </>
          )}
          .
        </p>
      </div>
      <p className="fineprint probability-method">
        Changes shown as % are percentage-point steps, not relative changes or
        independent effects. Their sizes depend on the order shown.
      </p>
    </figure>
  );
}
