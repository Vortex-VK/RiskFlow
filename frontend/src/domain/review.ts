export type ReviewEvent = {
  decision: string;
  model?: {
    alert: boolean;
    score?: { value: number; probabilityAvailable: boolean } | null;
  } | null;
};

/** Defaults preserve recorded decisions; previews use exact probability values. */
export function needsReview(
  event: ReviewEvent,
  threshold: number | null = null,
) {
  const score = event.model?.score;
  if (threshold !== null && score?.probabilityAvailable)
    return score.value >= threshold;
  return event.model
    ? event.model.alert
    : event.decision === "review" || event.decision === "block";
}

export function reviewIds(
  events: readonly (ReviewEvent & { eventId: string })[],
  threshold: number | null = null,
) {
  return new Set(
    events
      .filter((event) => needsReview(event, threshold))
      .map((event) => event.eventId),
  );
}

export function summarizeReview(
  events: readonly (ReviewEvent & { eventId: string; amountMinor: number })[],
  truth: Readonly<Record<string, string>>,
  threshold: number | null = null,
) {
  let reviews = 0,
    reviewAmount = 0,
    totalAmount = 0,
    tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  const bins = [0, 0, 0, 0, 0];
  for (const event of events) {
    const flagged = needsReview(event, threshold);
    totalAmount += event.amountMinor;
    if (flagged) {
      reviews++;
      reviewAmount += event.amountMinor;
    }
    const label = truth[event.eventId];
    if (label === "fraudulent") {
      if (flagged) tp++;
      else fn++;
    }
    if (label === "legitimate") {
      if (flagged) fp++;
      else tn++;
    }
    const score = event.model?.score;
    if (score?.probabilityAvailable)
      bins[Math.min(4, Math.floor(score.value / 20))]!++;
  }
  return {
    reviews,
    reviewAmount,
    totalAmount,
    tp,
    fp,
    fn,
    tn,
    bins,
    labeled: tp + fp + fn + tn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}
