import { integer, list, object, text } from "./decode";
import type { components } from "./generated";

export function decodeCardPattern(
  value: unknown,
): components["schemas"]["CardPatternReview"] | null {
  if (value == null) return null;
  const review = object(
    value,
    [
      "version",
      "scope",
      "bundleSha256",
      "margin",
      "threshold",
      "historyCount",
      "priorHourAttempts",
      "amountPercentile",
      "observations",
      "modelDecisionChanged",
      "probabilityAvailable",
      "priority",
    ],
    "card-pattern review",
  );
  if (
    (review.version !== "card-pattern-v1" &&
      review.version !== "card-pattern-v5") ||
    review.scope !== "review_only" ||
    review.modelDecisionChanged !== false ||
    review.probabilityAvailable !== false ||
    typeof review.bundleSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(review.bundleSha256) ||
    typeof review.margin !== "number" ||
    !Number.isFinite(review.margin) ||
    typeof review.threshold !== "number" ||
    !Number.isFinite(review.threshold) ||
    review.margin < review.threshold
  )
    throw new Error("Invalid card-pattern review.");
  integer(review.historyCount, 10, 20000, "review history");
  integer(review.priorHourAttempts, 0, 20000, "review attempts");
  if (
    review.amountPercentile !== null &&
    (typeof review.amountPercentile !== "number" ||
      !Number.isFinite(review.amountPercentile) ||
      review.amountPercentile < 0 ||
      review.amountPercentile > 1)
  )
    throw new Error("Invalid review percentile.");
  const observations = list(review.observations, 4, "review observations");
  if (observations.length < 2) throw new Error("Missing review observations.");
  observations.forEach((item) => text(item, "review observation", 300));
  if (review.version === "card-pattern-v5") {
    const priority = object(
      review.priority,
      ["version", "level", "margin", "threshold"],
      "card review priority",
    );
    if (
      priority.version !== "card-pattern-v2" ||
      (priority.level !== "prioritized" && priority.level !== "exploratory") ||
      typeof priority.margin !== "number" ||
      !Number.isFinite(priority.margin) ||
      typeof priority.threshold !== "number" ||
      !Number.isFinite(priority.threshold) ||
      (priority.level === "prioritized") !==
        priority.margin >= priority.threshold
    )
      throw new Error("Invalid card review priority.");
  } else if (review.priority != null) {
    throw new Error("Historical review cannot contain a new priority result.");
  }
  return review as components["schemas"]["CardPatternReview"];
}
