# Review capacity and measured explanations

The replay interface now uses one upload-wide queue. It shows `#4 of 250`
instead of presenting an upload percentile beside a daily-budget decision.
The slider starts at the suggested review count. Drag left to include more
payments, or right to include fewer. A marker identifies the starting position;
returning to that count restores the suggestion label. All replay highlights, filters, counters,
group investigations and supplied-label metrics use the same active queue.

## Automatic capacity

For at least 20 assessed transactions, the starting suggestion selects raw scores strictly above
`Q3 + 1.5 * (Q3 - Q1)`, using linearly interpolated sample quartiles. This is
the conventional Tukey upper fence, applied without labels. No separated tail
means zero suggestions. Equal scores never split at the automatic boundary.
Fewer than 20 rows use a clearly labelled 1% starting queue; identical scores
produce zero. Manual capacity can select anywhere from zero to all rows, with
source payment IDs breaking score ties deterministically.

This is a workload heuristic, not an estimate of how many frauds exist. Source
mix, score-distribution shape and upload composition can change its result.
It has no calibrated false-positive guarantee. A clean file can have outliers,
and fraud need not form an outlying score group.

The queue is a session-level investigation view. It does not mutate the frozen
model, the captured response, or stored assessments. The API and historical
benchmark receipts retain the original daily policy. The Samples panel labels
those numbers as fixed-budget reference results. Queue settings are reset on a
new run; they are not written into saved assessments.

## Numerical explanations

The existing explanation endpoint now dispatches by frozen bundle identity.
Historical probability explanations remain available. Stack explanations return
Tree SHAP contributions for the final head and the two strongest expert inputs.
Every set of contributions must reconstruct its recorded raw margin; the client
also validates the feature order, bundle, event identity and reconstructed scores.
There is no conversion of stack margins to fraud probability.

The chart adds the largest head contributions and the remaining grouped inputs
to the head baseline. At each step it maps the running score to a position among
the other transactions' unchanged scores, using the same source-ID tie order.
Step movements add to the total rank movement. Step sizes depend on order and
on this upload; they are not independent causal effects or a counterfactual
resimulation of transaction histories.

Expanded component details show their own strongest contributing measurements.
These are explanations inside each component, not an additive decomposition
through the entire nonlinear stack. Log-transformed amounts and counts are
displayed in their original units where possible.

The compact facts compare the current amount with a geometric mean from up to
100 strictly earlier account timestamp batches, requiring at least five earlier
purchases. They also show merchant visits, earlier hourly activity and channel
counts. Equal-time peers and future rows are excluded. Date-only uploads do not
claim hourly precision. These factual comparisons are displayed separately from
verified model contributions; an unusual observation alone is not a model reason.

Explicit `is_fraud` / `isFraud` columns now recognize binary outcome labels.
They populate evaluation labels only and never enter predictors or capacity
selection. Private upload diagnostics remain in ignored local research.
