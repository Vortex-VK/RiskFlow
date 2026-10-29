import evaluation from "./evaluation.json";
import { MAX_CSV_BYTES, MAX_OBJECTS, MAX_PAYMENTS } from "../../domain/limits";

const number = (value: number) => value.toLocaleString("en-US");
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const meanRecall =
  evaluation.datasets.reduce(
    (sum, row) => sum + row.detections / row.fraud,
    0,
  ) / evaluation.datasets.length;
const downloadableEvaluation = {
  ...evaluation,
  workspaceLimits: {
    payments: MAX_PAYMENTS,
    objects: MAX_OBJECTS,
    csvBytes: MAX_CSV_BYTES,
  },
};
const evaluatedRows = evaluation.datasets.reduce(
  (sum, row) => sum + row.rows,
  0,
);

export function ModelValidation() {
  return (
    <details className="model-validation">
      <summary>Model evaluation scope</summary>
      <h3>Find most fraud in a 5% review queue.</h3>
      <dl className="validation-numbers">
        <div>
          <dt>Fraud found, average</dt>
          <dd>{percent(meanRecall)}</dd>
        </div>
        <div>
          <dt>Payments reviewed</dt>
          <dd>{evaluation.reviewFraction * 100}%</dd>
        </div>
      </dl>
      <p>
        Across {number(evaluatedRows)} payments in five development datasets,
        reviewing the highest-ranked 5% found an average of{" "}
        {percent(meanRecall)} of labeled fraud. Each dataset has equal weight;
        results vary by source.
      </p>
      <details className="validation-source-results">
        <summary>Results by dataset</summary>
        <table className="validation-table validation-results-table">
          <caption>Results at 5% review capacity</caption>
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">Payments</th>
              <th scope="col">Fraud found</th>
              <th scope="col">False alerts</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.datasets.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>{number(row.rows)}</td>
                <td>
                  <strong>
                    {number(row.detections)} / {number(row.fraud)}
                  </strong>
                  <span>{percent(row.detections / row.fraud)}</span>
                </td>
                <td>{number(row.false_alerts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <section
        className="validation-strengths"
        aria-label="Explained review priorities"
      >
        <h3>See why a payment ranks higher.</h3>
        <p>
          Inspect the facts that raised or lowered its priority, with
          <strong> the exact point contribution beside each value</strong>.
          Purchase amounts, timing and merchant history become reasons you can
          examine. The displayed contributions add up to the priority score.
        </p>
      </section>
      <section
        className="validation-engine"
        aria-label="How the scoring engine works"
      >
        <h3>How the scoring engine works</h3>
        <p>
          <strong>{evaluation.expertCount} specialist models</strong> assess
          payment details and earlier spending patterns. A final model combines
          their assessments with{" "}
          <strong>{evaluation.historyFeatureCount} history measures</strong>,
          including changes in spending, payment timing and merchant
          familiarity. It weighs these signals together to assign a review
          priority. Auto suggests a queue from scores that stand out within your
          upload; you can adjust its size to fit your workload.
        </p>
      </section>
      <p className="validation-scope">
        Development results, not independent validation. The fixed 5% evaluation
        budget differs from Auto; samples are curated separately. Fraud labels
        never enter scoring. Priority scores are not fraud probabilities.
      </p>
      <a
        className="validation-download"
        href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(downloadableEvaluation, null, 2))}`}
        download="riskflow-engine-evaluation.json"
      >
        Download evaluation data
      </a>
    </details>
  );
}
