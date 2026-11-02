# Review capacity and measured explanations

The replay interface now uses one upload-wide queue. It shows `#4 of 250`
instead of presenting an upload percentile beside a daily-budget decision.
The slider starts at the suggested review count. Drag left to include more
payments, or right to include fewer. A marker identifies the starting position;
the slider has no helper text below it. All replay highlights, filters, counters,
group investigations and supplied-label metrics use the same active queue.

## Automatic capacity

For at least 20 assessed transactions, the starting suggestion selects raw scores strictly above
`Q3 + 1.5 * (Q3 - Q1)`, using linearly interpolated sample quartiles. This is
the conventional Tukey upper fence, applied without labels. No separated tail
means zero suggestions. Equal scores never split at the automatic boundary.
Fewer than 20 rows use a 1% starting queue; identical scores
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

The inspector compares a payment with the middle-ranked payment in the full
upload, using the first of the two central positions for even counts. The
benchmark uses the existing source-ID tie order and does not change with review
capacity, filters or playback. A one-payment upload compares the payment with
itself.

Priority points use `10 * (selected raw margin - middle-payment raw margin)`.
The middle payment is zero points. The scale is fixed, but the origin depends
on the upload. Scores can be negative or above 100;
they are neither probabilities nor an upload-normalized 0–100 index. Both
explanations must pass the existing identity and reconstruction checks and share
the same bundle and baseline. The client caches the two explanations; a failed
comparison shows a retry state rather than an unverified chart.

Each check's comparative contribution is its selected-payment SHAP value minus
its benchmark-payment SHAP value. The chart has a centered zero line and a
symmetric scale. It shows the four largest absolute differences, remaining
grouped inputs, and final total as a waterfall. Each floating bar starts at the
previous cumulative endpoint; connectors join consecutive steps. The total
extends from zero, and the waterfall can cross zero in either direction. Cumulative
contributions are rounded to 0.1 point and displayed changes are their
differences, so the visible changes sum exactly to the centered priority score.
These are additive explanations of the score difference,
not causal effects or a counterfactual resimulation of transaction histories.

Expanded details use `/api/v1/explanations/compare` and the method
`grouped-shapley-head-attribution-v1`. For each expert among the four displayed
checks, the calculation decomposes that check's **final-head attribution
difference**. Native expert SHAP differences select up to three changed
observations to display; native SHAP values are never rescaled into priority
points. The remaining expert observations and all other head inputs form one
explicit **Other context** group. Every coalition of these groups (at most 16)
is evaluated through the frozen expert, calibration and head; the game value is
the target check's final-head SHAP attribution. Exact grouped Shapley values
distribute both direct effects and interactions across these groups.

Empty and full coalitions must reproduce the actual middle/selected inputs and
attributions. The grouped values must sum to the parent's difference. The client
also verifies identities, feature names, available recorded observations and
both levels of arithmetic. These are explanations conditional on this grouping,
not unique feature importance, causal effects or feasible alternative histories.
“Other context” includes remaining observations and interaction context from
other checks; it is computed, not an unexplained balancing amount.

The detail rows use the same priority-point units as their heading. Cumulative
rounding is aligned to the parent waterfall endpoints; any final tenth-rounding
adjustment is included in Other context. All displayed rows add exactly to their
heading. There is no duplicate check total. Log-transformed amounts and counts
are displayed in their original units where possible.

The inspector shows the centered priority score in its review-status color.
It omits the zero-point definition, middle-payment value and identity,
separate score-gap row, reference bar, and direction sentences.
Each check has one heading containing its signed priority-point contribution;
that heading is the disclosure control when details are available. Expanded
details show each observation's name and measured value beside a diverging bar
and its signed priority points. The displayed observations sort by absolute
point contribution, with Other context kept last. All check bars share one scale,
including the context rows; positive effects extend right and negative effects
extend left of zero. Sorting is presentation-only and retains the reconciled
rounded contributions. It does not change which observations the grouped
explanation calculation selected.

Observation rows are plain, noninteractive rows. Repeated observations retain
independent values and contributions within each check, without check-count badges.
Standalone factual sentences use one muted text style with no forced line break.
Known merchant category codes use short names with the
original code beneath; unsupported codes remain explicit codes and text categories
remain unchanged. The display lookup uses the
[Fiserv MCC listing](https://docs.fiserv.dev/public/docs/merchant-category-codes)
and does not modify model inputs.
Negative priority points mean below the middle payment, not confirmed legitimacy.

Standalone head observations now show one factual description of the selected
account instead of “This / Middle” pairs. Method frequency is the share of earlier
payments using the current payment method; a zero-history account is shown as
having no comparison history. Gap ratios are shown as a percent longer or shorter
than that account's usual wait, and account history is a count of earlier payments.
The score attribution still compares with the same middle-ranked payment.

“Remaining factors” expands the final-head contributions outside the four leading
rows. These are disjoint from those rows, not another subtotal of them. Their
rounded points reconcile to the remainder heading; zero-point rows are omitted.

Cluster names sit over their cluster centers and wrap to a width based on the
visible cluster size. Visible names and review badges have their own pointer
targets, including portions outside the underlying territory polygon. Hidden
crowded labels do not intercept clicks; dragging across a label still pans.

In playback, a cluster's review badge opens the payment list filtered to that
cluster's currently revealed review payments and pauses playback. Opening the
list preserves the graph position; the cluster name still zooms into its group.
Review lists sort by rank, highest priority first, before filtering or pagination.
The list follows review-capacity changes. The summary's need-review count opens
the full queue. Badge and name are separate buttons
with keyboard support.

The summary's need-review total is a neutral-text control with a red underline
and no filled background, retaining button semantics and keyboard access. Each
number and label is centered together within space reserved for the upload's
maximum digit count, keeping the summary size stable across capacity changes.

CSV workspace capacity is 25,000 payments in the parser, request schemas and
payment-count result fields. The object cap is 5,000, including accounts, merchants and context objects.
There is no separate account cap, so 1,000 accounts fit within that total.
CSV bytes, JSON request bytes, association counts and retained-import limits
are unchanged.

The compact facts compare the current amount with a geometric mean from up to
100 strictly earlier account timestamp batches, requiring at least five earlier
purchases. They also show merchant visits, earlier hourly activity and channel
counts. Equal-time peers and future rows are excluded. Date-only uploads do not
claim hourly precision. These factual comparisons are displayed separately from
verified model contributions; an unusual observation alone is not a model reason.

Explicit `is_fraud` / `isFraud` columns now recognize binary outcome labels.
They populate evaluation labels only and never enter predictors or capacity
selection. Private upload diagnostics remain in ignored local research.

## Simulation readiness

The workspace bar is present only when a payment exists and graph reveal has
finished. It fades in at readiness and fades out after clear or removal of the
last payment. Exiting controls become inert immediately. Both the UI action and
simulation store reject attempts to simulate during reveal. Keyboard undo/redo
remain available while the bar is hidden.

Workspace and playback status announcements are screen-reader-only; the area above
the bottom bar has no visible status text. Load and simulation errors appear near
the top of the workspace. The workspace footer omits the session label and zoom
buttons; wheel and gesture zoom remain available. Both graph views hide React
Flow's attribution using its built-in option.

The playback bar contains Edit scenario, Play/Pause (Play again when complete),
Next flagged when available, and Speed. Previous, Next, Replay and Reset playback
controls are removed. Flagged only lives in the review-capacity summary.

The waterfall marks the last included payment's centered score with a short,
review-cutoff line confined to the Total column. Its numeric-only label sits
to the right in a reserved gutter, with no backing or overlap with the bar.
The axis depends only
on the selected payment's waterfall. Cutoffs outside that range are hidden, and
the label shifts inward at the top and bottom boundaries. The marker updates
with capacity; zero capacity has no marker. Total has a wider outlined bar and a stronger endpoint;
its review/no-alert color follows the actual queue membership, including score
ties resolved by rank. All contributions retain their existing signed colors.
