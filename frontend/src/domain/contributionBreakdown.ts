import type { PaymentExplanation } from "../api/paymentExplanation";
import calibration from "../../../contracts/adaptation-spec.json";

/** The installed model's calibrated mapping, including the runtime's logit clipping. */
export function scoreProbability(score: number) {
  const logit = Math.max(
    -calibration.logit_clip,
    Math.min(
      calibration.logit_clip,
      calibration.slope * score + calibration.intercept,
    ),
  );
  return 100 / (1 + Math.exp(-logit));
}

/** A sequential display of raw SHAP additions through the nonlinear mapping, not probability SHAP. */
export function probabilityWalkthrough(data: PaymentExplanation) {
  const breakdown = contributionBreakdown(data);
  const start = scoreProbability(data.baseValue);
  const final = scoreProbability(data.rawMargin);
  const tail = Math.min(final, 100 - final);
  const precision = tail < 0.0001 ? 6 : tail < 0.01 ? 4 : 2;
  const factor = 10 ** precision;
  const displayUnits = (p: number) => Math.round(p * factor);
  if (Math.abs(final - data.probability) > 1e-6)
    throw new Error(
      "Explanation does not match the installed probability calibration.",
    );
  const convertStep = (step: (typeof breakdown.steps)[number]) => {
    const from = scoreProbability(step.from);
    const to = scoreProbability(step.to);
    return {
      ...step,
      from,
      to,
      change: to - from,
      // Differences of displayed endpoints keep the displayed sum consistent too.
      displayChange: (displayUnits(to) - displayUnits(from)) / factor,
    };
  };
  const steps = breakdown.steps.map(convertStep);
  const otherStep = breakdown.steps.find((step) => step.label === "Other");
  let running = otherStep?.from ?? data.rawMargin;
  const otherSteps = breakdown.remaining.map((row, i) => {
    const from = running;
    running += row.contribution;
    // Keep the final endpoint identical to the grouped total despite summation rounding.
    if (i === breakdown.remaining.length - 1) running = otherStep!.to;
    return {
      ...convertStep({
        label: String(i + 1),
        feature: row.feature,
        value: row.contribution,
        from,
        to: running,
      }),
      observedValue: row.value,
    };
  });
  return { ...breakdown, start, final, steps, otherSteps, precision };
}

export function signedProbabilityPoints(value: number, precision = 2) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(precision)}%`;
}

export function signedContribution(value: number) {
  if (value === 0) return "0.000";
  return `${value > 0 ? "+" : "−"}${Math.abs(value) < 0.001 ? "<0.001" : Math.abs(value).toFixed(3)}`;
}

export function contributionBreakdown(data: PaymentExplanation) {
  const ranked = [...data.contributions].sort(
    (a, b) =>
      Math.abs(b.contribution) - Math.abs(a.contribution) ||
      a.feature.localeCompare(b.feature),
  );
  const nonzero = ranked.filter((r) => r.contribution !== 0);
  const visible = nonzero.slice(0, 5);
  // Keep both directions visible when a long list of one sign would hide the other.
  for (const sign of [-1, 1]) {
    if (!visible.some((r) => Math.sign(r.contribution) === sign)) {
      const opposite = nonzero.find((r) => Math.sign(r.contribution) === sign);
      if (opposite) visible[visible.length - 1] = opposite;
    }
  }
  const selected = new Set(visible.map((r) => r.feature));
  const omitted = nonzero.filter((r) => !selected.has(r.feature));
  const other = omitted.reduce((sum, r) => sum + r.contribution, 0);
  let running = data.baseValue;
  const steps = [
    ...visible.map((r, i) => ({
      label: `${i + 1}`,
      feature: r.feature,
      value: r.contribution,
    })),
    ...(omitted.length
      ? [{ label: "Other", feature: "Other factors", value: other }]
      : []),
  ].map((r) => {
    const from = running;
    running += r.value;
    return { ...r, from, to: running };
  });
  // A shared zero-centered scale never stretches a tiny contribution to a full bar.
  const extent = Math.max(
    10,
    Math.ceil(
      Math.max(
        Math.abs(data.baseValue),
        Math.abs(data.rawMargin),
        ...steps.map((s) => Math.max(Math.abs(s.from), Math.abs(s.to))),
      ) / 5,
    ) * 5,
  );
  return {
    ranked,
    visible,
    other,
    omitted: omitted.length,
    remaining: omitted,
    steps,
    extent,
  };
}
