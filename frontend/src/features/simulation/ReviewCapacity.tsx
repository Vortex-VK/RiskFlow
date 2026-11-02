import type { CSSProperties } from "react";
import type { suggestCapacity } from "../../domain/reviewQueue";

export function ReviewCapacity({
  count,
  total,
  suggestion,
  onChange,
}: {
  count: number;
  total: number;
  suggestion: ReturnType<typeof suggestCapacity>;
  onChange: (value: number | null) => void;
}) {
  // The 14px thumb travels inside the track, so its center stops 7px from either end.
  const position = (value: number) => {
    const fraction = total ? 1 - value / total : 1;
    return `calc(${fraction * 100}% + ${7 - 14 * fraction}px)`;
  };
  const update = (value: number) => {
    const next = Math.max(0, Math.min(total, Math.round(value)));
    onChange(next === suggestion.count ? null : next);
  };
  return (
    <div className="threshold-control capacity-control">
      <div className="threshold-heading">
        <label htmlFor="review-capacity">Review capacity</label>
      </div>
      <div className="capacity-track">
        <span
          className="capacity-default-marker"
          aria-hidden="true"
          style={{
            left: position(suggestion.count),
          }}
        />
        <input
          id="review-capacity"
          type="range"
          dir="rtl"
          min={0}
          max={total || 1}
          step={1}
          value={count}
          disabled={!total}
          style={
            {
              "--threshold-position": position(count),
            } as CSSProperties
          }
          aria-valuetext={`${count} of ${total} transactions`}
          onChange={(e) => update(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
