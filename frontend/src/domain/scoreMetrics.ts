export type ScoredObservation = {
  raw: number;
  value: number;
  distance: number;
  probability?: boolean;
  label: boolean | null;
};

/** Tie-aware ranking metrics use exact raw margins, never rounded display indices. */
export function rankingMetrics(rows: readonly ScoredObservation[]) {
  const labeled = rows
    .filter((r) => r.label !== null)
    .sort((a, b) => b.raw - a.raw);
  const positives = labeled.filter((r) => r.label).length;
  const negatives = labeled.length - positives;
  if (!positives || !negatives)
    return { ap: null, auc: null, positives, negatives };
  let tp = 0,
    fp = 0,
    ap = 0,
    concordant = 0;
  for (let i = 0; i < labeled.length;) {
    let j = i,
      p = 0,
      n = 0;
    while (j < labeled.length && labeled[j]!.raw === labeled[i]!.raw) {
      if (labeled[j]!.label) p++;
      else n++;
      j++;
    }
    concordant += p * (negatives - fp - n + n / 2);
    tp += p;
    fp += n;
    ap += (p / positives) * (tp / (tp + fp));
    i = j;
  }
  return {
    ap,
    auc: concordant / (positives * negatives),
    positives,
    negatives,
  };
}

export function thresholdMetrics(
  rows: readonly ScoredObservation[],
  cutoff: number,
  reference = false,
) {
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0,
    reviews = 0;
  for (const row of rows) {
    // Compare unrounded margins, including at the original cutoff of 50.
    const boundary = Math.log(cutoff / (100 - cutoff));
    const selected = reference
      ? row.distance >= 0
      : row.probability
        ? row.value >= cutoff
        : row.distance >= boundary;
    if (selected) reviews++;
    if (row.label === null) continue;
    if (row.label) {
      if (selected) tp++;
      else fn++;
    } else if (selected) fp++;
    else tn++;
  }
  return {
    tp,
    fp,
    fn,
    tn,
    reviews,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}

/** Proper probability losses; never applied to historical display-only indices. */
export function probabilityMetrics(rows: readonly ScoredObservation[]) {
  const labeled = rows.filter((r) => r.label !== null && r.probability);
  if (!labeled.length) return null;
  const bins = Array.from({ length: 10 }, (_, i) => ({
    lower: i * 10,
    upper: (i + 1) * 10,
    count: 0,
    total: 0,
    fraud: 0,
  }));
  let squared = 0,
    logLoss = 0,
    fraudSquared = 0,
    regularSquared = 0,
    fraud = 0;
  for (const r of labeled) {
    const p = r.value / 100,
      y = r.label ? 1 : 0,
      error = (p - y) ** 2;
    const safe = Math.min(1 - 1e-6, Math.max(1e-6, p));
    const bin = bins[Math.min(9, Math.floor(p * 10))]!;
    bin.count++;
    bin.total += r.value;
    bin.fraud += y;
    squared += error;
    logLoss -= y * Math.log(safe) + (1 - y) * Math.log1p(-safe);
    if (r.label) {
      fraud++;
      fraudSquared += error;
    } else regularSquared += error;
  }
  return {
    bins: bins
      .filter((b) => b.count > 0)
      .map((b) => ({
        lower: b.lower,
        upper: b.upper,
        count: b.count,
        mean: b.total / b.count,
        observed: (100 * b.fraud) / b.count,
      })),
    brier: squared / labeled.length,
    logLoss: logLoss / labeled.length,
    rmse: 100 * Math.sqrt(squared / labeled.length),
    fraudRmse: fraud ? 100 * Math.sqrt(fraudSquared / fraud) : null,
    legitimateRmse:
      labeled.length > fraud
        ? 100 * Math.sqrt(regularSquared / (labeled.length - fraud))
        : null,
  };
}
