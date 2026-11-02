import type { CSSProperties } from "react";

export function ProbabilityThreshold({
  threshold,
  onChange,
}: {
  threshold: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="threshold-control">
      <div className="threshold-heading">
        <label htmlFor="review-threshold">Probability threshold</label>
        <span className="threshold-value">{threshold.toFixed(2)}%</span>
      </div>
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
    </div>
  );
}
