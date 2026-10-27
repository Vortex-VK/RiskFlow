import type { CSSProperties } from "react";
import type { EvidenceScore } from "../../api/decodeScores";

const labels: Record<EvidenceScore["source"], string> = {
  adapted_card: "Card",
  adapted_online: "Online",
  coverage: "Card",
  online_specialist: "Online",
  card_pattern: "Card pattern",
  card_priority: "Card priority",
};

export function ProbabilityThreshold({
  scores,
  threshold,
  onChange,
}: {
  scores: readonly EvidenceScore[];
  threshold: number | null;
  onChange: (value: number | null) => void;
}) {
  const defaults = [
    ...new Map(
      scores.map((score) => [
        `${score.source}:${score.referenceValue}`,
        { label: labels[score.source], value: score.referenceValue },
      ]),
    ).values(),
  ].sort((a, b) => a.value - b.value);

  return (
    <div className="threshold-control">
      <div className="threshold-heading">
        {threshold === null ? (
          <span>Probability thresholds</span>
        ) : (
          <label htmlFor="review-threshold">Probability threshold</label>
        )}
        <span className="threshold-value">
          {threshold === null ? "Model defaults" : `${threshold.toFixed(2)}%`}
        </span>
      </div>
      {threshold === null ? (
        <div className="threshold-defaults" aria-label="Active model cutoffs">
          {defaults.map(({ label, value }) => (
            <span key={`${label}:${value}`}>
              {label} <b>{value.toFixed(2)}%</b>
            </span>
          ))}
        </div>
      ) : (
        <input
          id="review-threshold"
          type="range"
          min="0"
          max="100"
          step="0.01"
          value={threshold}
          style={{ "--threshold-position": `${threshold}%` } as CSSProperties}
          aria-valuetext={`${threshold.toFixed(2)}% for all payments`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
      <div className="threshold-caption">
        <span>
          {threshold === null
            ? "Cutoffs follow the payment type"
            : "One cutoff for all payments · scores unchanged"}
        </span>
        {threshold === null ? (
          <button
            onClick={() =>
              onChange(
                Math.ceil(Math.max(...defaults.map((d) => d.value)) * 100) /
                  100,
              )
            }
          >
            Use one cutoff
          </button>
        ) : (
          <button onClick={() => onChange(null)}>Reset defaults</button>
        )}
      </div>
    </div>
  );
}
