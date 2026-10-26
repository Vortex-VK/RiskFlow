# Purchase discrimination experiment

Authorized after Phase 4: improve purchase discrimination and false-alert burden, preserving the portfolio scope and existing graph/history workflows. No ML or account-specific exceptions.

Before inspecting new outcomes, reserve users 296-423 for a final test. Users 168-295 are development. Select all January-June 2018 records, with January-February warm-up and March-June evaluation. Previously inspected users 0-167 are not the new holdout. Preserve all empty users and exclusions without replacement.

Compare the existing rule with three predeclared amount hypotheses:

1. Pooled dispersion: medium threshold is max(3 * median, median + 6 * MAD); high is max(6 * median, median + 12 * MAD).
2. Category dispersion: use the current exact category's prior completed purchases when that subset meets the same 10-sample, 7-day span and 30-day freshness gates; otherwise use the pooled purchase history. Apply the dispersion thresholds above.
3. Category upper tail: same population selection; medium threshold max(2 * median, ceil(1.25 * empirical 95th percentile)); high max(3 * median, ceil(1.5 * empirical 95th percentile)). Nearest-rank percentile; all integer cents. This tests ordinary spending spread rather than treating every multiple of a small median as exceptional.

Keep purchase windows at 90 days, all other rules and review/high-priority policies unchanged. Do not use future or same-time spending, labels, card-as-device assumptions, merchant geography-as-customer-location, or feedback from risk decisions. Bill populations and explicitly configured baselines keep their existing semantics.

Promotion criterion on development: at least 25% fewer legitimate alerts without fewer detected fraud-labelled events than the current engine. Among qualifying candidates prefer fewer false alerts, then greater true detections. Freeze the selected mechanism before examining reserved outcomes. If none qualify, report the tradeoff rather than quietly calling fewer alerts a fix. This is a development selection rule, not a banking operating target.

Implementation sequence: extract disjoint cohorts; calculate label-independent candidate predictions; inspect development metrics; implement only a justified candidate with versioned evidence and old-run compatibility; independently check implementation; freeze it; evaluate reserved outcomes once; complete regression checks and report both improvements and regressions honestly.

Development finding: all three amount-only candidates failed promotion (current 15 TP/2,244 FP; pooled dispersion 11/1,464; category dispersion 12/1,932; category upper tail 8/886). Do not deploy these merely because they reduce workload. Inspection found 52 of 83 fraud-labelled events scored zero, often at ordinary or small amounts. A follow-up development hypothesis tests a different behavior: four distinct previously unseen merchants within 24 hours, including a currently unseen merchant, compared with completed purchases in the preceding 90-day history before that window. Require the same ten samples/seven-day span/thirty-day freshness gate for that history. Test this pattern alongside the category-tail amount candidate; keep the original promotion criterion. Reserved outcomes remain unopened. This is a pattern hypothesis, not a claim that a new merchant is fraudulent.

The merchant-burst probe also failed (combined 9 TP/968 FP). A narrower follow-up preserves the original detector for unfamiliar spending and checks whether its amount alerts contradict repeated actual purchases at the same merchant and category. Require at least three strictly prior completed spending samples on three dates spanning seven days within the existing 90-day window, newest within 30 days. If the current amount does not exceed the largest such observed amount, the amount alone is not a new deviation; preserve every other rule. Otherwise retain the original 3x/6x amount points. This recognizes a previously observed spending range, not merchant trust or confirmed legitimacy. Test against the same development criterion before implementation; no reserved labels inspected.
