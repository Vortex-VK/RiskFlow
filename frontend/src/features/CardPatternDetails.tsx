import type { components } from "../api/generated";
import type { DeepReadonly } from "../domain/runs";
import "./CardPatternDetails.css";

export function CardPatternDetails({
  review,
}: {
  review:
    DeepReadonly<components["schemas"]["CardPatternReview"]> | null | undefined;
}) {
  if (!review) return null;
  return (
    <section className="card-pattern-review" aria-label="Card-pattern review">
      <h3>Additional card review</h3>
      {review.priority && (
        <p>
          <strong>
            {review.priority.level === "prioritized"
              ? "Prioritized review"
              : "Exploratory lead"}
          </strong>
          {review.priority.level === "prioritized"
            ? ": the second pattern model also flags this lead. Review it first."
            : ": the second pattern model does not corroborate this lead. It remains available for investigation."}{" "}
          Priority is a review order, not a fraud probability.
        </p>
      )}
      <p>
        The pattern specialist suggests checking this purchase. The primary
        model result remains “no model alert”. This suggestion does not identify
        fraud or change the model metrics.
      </p>
      <ul>
        {review.observations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <details>
        <summary>Review model details</summary>
        <p>
          Experimental models trained on synthetic card activity. Limited
          validation; legitimate purchases can be suggested for review.
        </p>
        {review.priority && (
          <p>
            Priority margin {review.priority.margin.toFixed(4)} · threshold{" "}
            {review.priority.threshold.toFixed(4)}. Lower-priority leads are
            retained; model alert counts are unchanged.
          </p>
        )}
        <p>
          Pattern margin {review.margin.toFixed(4)} · threshold{" "}
          {review.threshold.toFixed(4)}. These values are not fraud
          probabilities.
        </p>
      </details>
    </section>
  );
}
