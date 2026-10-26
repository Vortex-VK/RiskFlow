import { useMemo, useState } from "react";
import type { components } from "../api/generated";
import type { DeepReadonly } from "../domain/runs";
import {
  rankingMetrics,
  thresholdMetrics,
  probabilityMetrics,
} from "../domain/scoreMetrics";
import { PaymentPages } from "./PaymentPages";
import "./ContinuousScores.css";

type Event = DeepReadonly<components["schemas"]["EventResult"]>;
const labels = {
  adapted_card: "Card payments",
  adapted_online: "Online payments",
  coverage: "Card payments",
  online_specialist: "Online payments",
  card_pattern: "Card specialist",
  card_priority: "Card prioritizer",
};
type Source = keyof typeof labels;
const percent = (n: number | null) =>
  n === null ? "N/A" : `${(n * 100).toFixed(2)}%`;

export function ScoreExplorer({
  events,
  truth,
  sourceId,
  inspect,
}: {
  events: readonly Event[];
  truth: Readonly<Record<string, string>>;
  sourceId: (id: string) => string;
  inspect: (event: Event) => void;
}) {
  const [source, setSource] = useState<Source>("coverage");
  const [selectedCutoff, setCutoff] = useState<number | null>(null);
  const observations = useMemo(
    () =>
      events.flatMap((event) => {
        const scores = [
          event.model?.score,
          event.cardScores?.pattern,
          event.cardScores?.priority,
        ];
        return scores
          .filter((s) => s != null)
          .map((score) => ({
            event,
            score,
            raw: score.rawMargin,
            value: score.value,
            distance: score.distance,
            probability: score.probabilityAvailable,
            label:
              truth[event.eventId] === "fraudulent"
                ? true
                : truth[event.eventId] === "legitimate"
                  ? false
                  : null,
          }));
      }),
    [events, truth],
  );
  const sources = (Object.keys(labels) as Source[]).filter((s) =>
    observations.some((r) => r.score.source === s),
  );
  const active = sources.includes(source) ? source : sources[0];
  const rows = useMemo(
    () =>
      observations
        .filter((r) => r.score.source === active)
        .sort((a, b) => b.raw - a.raw),
    [observations, active],
  );
  const ranking = useMemo(() => rankingMetrics(rows), [rows]);
  const isProbability = rows[0]?.score.probabilityAvailable ?? false;
  const referenceValue = rows[0]?.score.referenceValue ?? 50;
  const cutoff = selectedCutoff ?? referenceValue;
  const losses = useMemo(() => probabilityMetrics(rows), [rows]);
  const preview = thresholdMetrics(rows, cutoff),
    reference = thresholdMetrics(
      rows,
      referenceValue,
      rows[0]?.score.version !== "fraud-probability-v2",
    );
  if (!active) return null;
  const exportScores = () => {
    const cell = (value: unknown) => {
      let s = String(value ?? "");
      if (/^[=+@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv = [
      [
        "event_id",
        "model",
        isProbability
          ? "estimated_fraud_probability_percent"
          : "score_0_100_not_probability",
        "raw_margin",
        "reference_threshold",
        "distance",
        "label",
        "primary_model_reference_alert",
        "score_version",
        "probability_bundle_sha256",
      ],
      ...rows.map((r) => [
        sourceId(r.event.eventId),
        active,
        r.value,
        r.raw,
        r.score.referenceThreshold,
        r.score.distance,
        r.label === null ? "" : r.label,
        r.event.model?.alert,
        r.score.version,
        r.score.probabilityBundleSha256 ?? "",
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `riskflow-${active}-scores.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="score-explorer">
      <summary>Scores and threshold explorer</summary>
      <section aria-label="Score evaluation">
        <p>
          Explore continuous scores independently of the saved alert decisions.
          {isProbability
            ? ` Scores are estimated fraud probabilities fitted on ${rows[0]?.score.calibrationScope === "ibm_authored_synthetic" ? "IBM and authored" : "IBM"} synthetic data. Calibration for this upload is unverified.`
            : " The historical 0–100 scale is not a fraud probability."}{" "}
          Compare rankings within one model.
        </p>
        <label>
          Score model
          <select
            value={active}
            onChange={(e) => {
              setSource(e.target.value as Source);
              setCutoff(null);
            }}
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </label>
        <p>
          {rows.length} scored transactions · {ranking.positives} labeled frauds
          · {ranking.negatives} labeled legitimate.
        </p>
        <p>
          Average precision: {percent(ranking.ap)} · ROC AUC:{" "}
          {percent(ranking.auc)}.
        </p>
        <p className="fineprint">
          Ranking metrics use exact raw margins and require both labeled
          classes. Average precision summarizes the precision/recall tradeoff;
          ROC AUC measures ranking separation. Small or curated uploads do not
          establish general accuracy.
        </p>
        {losses && (
          <div aria-label="Probability evaluation">
            <p>
              Brier score: {losses.brier.toFixed(6)} · Log loss:{" "}
              {losses.logLoss.toFixed(6)}.
            </p>
            <p>
              RMSE: {losses.rmse.toFixed(2)} points · Fraud RMSE:{" "}
              {losses.fraudRmse?.toFixed(2) ?? "N/A"} · Legitimate RMSE:{" "}
              {losses.legitimateRmse?.toFixed(2) ?? "N/A"}.
            </p>
            <p className="fineprint">
              Lower losses are better. Overall loss can hide missed fraud when
              legitimate transactions dominate.
            </p>
            <details>
              <summary>Probability reliability by group</summary>
              <table>
                <caption>
                  Estimated versus observed fraud on labeled transactions
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Range</th>
                    <th scope="col">Count</th>
                    <th scope="col">Mean estimate</th>
                    <th scope="col">Observed fraud</th>
                  </tr>
                </thead>
                <tbody>
                  {losses.bins.map((b) => (
                    <tr key={b.lower}>
                      <th scope="row">
                        {b.lower}–{b.upper}%
                      </th>
                      <td>{b.count}</td>
                      <td>{b.mean.toFixed(2)}%</td>
                      <td>{b.observed.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="fineprint">
                These groups describe this file only. Sparse groups do not
                establish calibration. Empty groups are omitted.
              </p>
            </details>
          </div>
        )}
        <label>
          Preview cutoff:{" "}
          <output>
            {cutoff.toFixed(2)}
            {isProbability ? "%" : " / 100"}
          </output>
          <input
            type="range"
            aria-label="Preview score cutoff"
            min={0}
            max={100}
            step="any"
            value={cutoff}
            onChange={(e) => setCutoff(Number(e.target.value))}
          />
        </label>
        <button onClick={() => setCutoff(null)}>
          Reset to reference cutoff
        </button>
        {isProbability && (
          <button onClick={() => setCutoff(90)}>Preview 90%+ estimates</button>
        )}
        <table>
          <caption>Independent score threshold comparison</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Reference {referenceValue.toFixed(2)}</th>
              <th scope="col">Preview {cutoff.toFixed(2)}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Above cutoff", reference.reviews, preview.reviews],
                ["Frauds found", reference.tp, preview.tp],
                ["Frauds missed", reference.fn, preview.fn],
                ["Legitimate above cutoff", reference.fp, preview.fp],
                [
                  "Precision",
                  percent(reference.precision),
                  percent(preview.precision),
                ],
                ["Recall", percent(reference.recall), percent(preview.recall)],
              ] as const
            ).map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Preview only: saved decisions and headline metrics stay at their
          reference thresholds. Counts here assess each score independently;
          specialist scores include transactions already flagged by the primary
          model. Unlabeled transactions count toward workload, but not precision
          or recall.
        </p>
        <button onClick={exportScores}>Download scores CSV</button>
        <h3>Transactions ranked by {labels[active]} score</h3>
        {isProbability && (
          <p>
            {rows.filter((r) => r.value >= 90).length} transactions have
            estimates of 90% or higher. Highlighted for investigation; this is
            not measured accuracy or a confirmed fraud verdict.
          </p>
        )}
        <PaymentPages
          key={active}
          items={rows}
          identify={(r) => sourceId(r.event.eventId)}
        >
          {(r) => (
            <button
              className={`wide${r.probability && r.value >= 90 ? " high-estimated-risk" : ""}`}
              key={r.event.eventId}
              onClick={() => inspect(r.event)}
            >
              {sourceId(r.event.eventId)} · {r.value.toFixed(2)}
              {isProbability ? "%" : " / 100"}
              {r.probability && r.value >= 90 && " · High estimated risk"}
            </button>
          )}
        </PaymentPages>
      </section>
    </details>
  );
}
