import { Brand } from "../../app/Brand";
import evaluation from "../samples/evaluation.json";
import "./landing.css";

const number = (value: number) => value.toLocaleString("en-US");
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const screenshot = (name: string) =>
  `${import.meta.env.BASE_URL}landing/${name}.png`;
const ibm = evaluation.datasets.find((dataset) => dataset.id === "ibm")!;
const meanRecall =
  evaluation.datasets.reduce(
    (sum, row) => sum + row.detections / row.fraud,
    0,
  ) / evaluation.datasets.length;
const evaluatedRows = evaluation.datasets.reduce(
  (sum, row) => sum + row.rows,
  0,
);
function TechnicalDetails() {
  return (
    <details className="landing-technical" id="under-the-hood">
      <summary>
        <span>
          <span className="landing-eyebrow">For the curious</span>
          <span className="landing-technical-title">Under the hood</span>
          <span className="landing-technical-hint">
            Graph construction, model architecture &amp; evaluation
          </span>
        </span>
        <span className="landing-plus" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="landing-technical-body">
        <section>
          <h3>How the graph is built</h3>
          <p>
            CSV fields are mapped to stable account and merchant identities.
            Payments connect accounts to merchants; available device and
            location records add context. Repeated payments between the same
            account and merchant can be inspected through their shared
            connection.
          </p>
          <p>
            For larger graphs, account communities use weighted shared-merchant
            and observed-device connections. Common merchants are downweighted;
            shared devices receive stronger weight. Similarity is normalized by
            account feature counts, then a deterministic greedy modularity
            algorithm merges groups only when modularity improves, at resolution
            1.
          </p>
          <p>
            The hierarchy exposes materially stronger subgroups, then accounts
            and finer transaction groups. Group names summarize observed
            context. Graph proximity and community membership are navigation
            aids, not evidence that an account is fraudulent. Moving an object
            changes the layout, not its model score.
          </p>
        </section>
        <section>
          <h3>Inside Stack-d5</h3>
          <p>
            Eight frozen CatBoost experts produce scores transformed through
            reference cumulative distributions into logit-scaled inputs. A
            frozen depth-5 CatBoost head combines them with 33
            transaction-history features. The nine model files and reference
            scales are hash-checked; requests do not train or select models.
          </p>
          <p>
            History uses earlier observations only. Equal-time transactions do
            not inform one another. Date-only or mixed-precision uploads use
            whole-day batches with calendar signals masked. Fraud labels are
            excluded from scoring.
          </p>
          <div
            className="landing-engine-flow"
            aria-label="Model scoring pipeline"
          >
            <span>Payment + prior history</span>
            <b aria-hidden="true">→</b>
            <span>8 experts</span>
            <b aria-hidden="true">→</b>
            <span>Reference scaling + 33 features</span>
            <b aria-hidden="true">→</b>
            <span>Depth-5 head</span>
            <b aria-hidden="true">→</b>
            <span>Review ranking</span>
          </div>
          <p>
            Inference runs on CPU and needs no external model API or GPU. The
            scoring bundle is {number(evaluation.capabilities.modelBundleBytes)}{" "}
            bytes, excluding application code, dependencies and in-memory data.
          </p>
        </section>
        <section>
          <h3>Ranking, capacity and explanations</h3>
          <p>
            The raw margin is an uncalibrated ranking score. Priority points are
            10 × the difference between a payment’s margin and the middle-ranked
            payment’s margin in the upload. These points are not fraud
            probabilities and can be negative or exceed 100.
          </p>
          <p>
            For at least 20 assessed payments, Auto selects scores above Q3 +
            1.5 × IQR. Smaller uploads start with a 1% queue, rounded up;
            identical scores produce no automatic suggestions. Manual capacity
            can select zero to all payments, with source IDs breaking score
            ties. This upload-wide view is separate from the API’s recorded
            daily 1% policy and the evaluation’s fixed 5% budget.
          </p>
          <p>
            Final-head Tree SHAP differences explain priority relative to the
            middle payment. Expanded expert checks use exact grouped Shapley
            attribution, including an explicit Other context group. Both levels
            reconstruct their totals at 0.1-point display precision.
            Contributions explain a score difference; they are not causal
            effects or proof of fraud.
          </p>
        </section>
        <section>
          <h3>Supported inputs</h3>
          <p>
            Scoring supports positive USD purchases up to $1,000,000, stable
            account and merchant identities, and timestamps with an explicit
            timezone or date-only precision. Category/MCC, channel, completion
            status and merchant geography are optional. Missing optional CSV
            values stay unknown. Unsupported records can be explored with Graph
            only, but cannot all be simulated. Native IBM exports use the
            documented USD/UTC and completion-status adapter conventions.
          </p>
        </section>
        <section>
          <h3>Development evaluation, by source</h3>
          <p>
            Each dataset’s highest-ranked 5% is reviewed, rounded up, in one
            batch. The {percent(meanRecall)} headline is the equal-weight mean
            of the five fraud-recall values. These datasets were exposed during
            development; this is not an independent test, pooled accuracy, or a
            prediction for new uploads.
          </p>
          <div
            className="landing-table-scroll"
            role="region"
            aria-label="Development evaluation results"
            tabIndex={0}
          >
            <table>
              <caption>Stack-d5 · fixed 5% review budget</caption>
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Payments</th>
                  <th scope="col">Fraud found</th>
                  <th scope="col">Recall</th>
                  <th scope="col">Selected for review</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.datasets.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    <td>{number(row.rows)}</td>
                    <td>
                      {number(row.detections)} / {number(row.fraud)}
                    </td>
                    <td>{percent(row.detections / row.fraud)}</td>
                    <td>{number(row.reviews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="landing-text-link"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(evaluation, null, 2))}`}
            download="riskflow-development-evaluation.json"
          >
            Download evaluation data &amp; model hashes{" "}
            <span aria-hidden="true">↓</span>
          </a>
        </section>
      </div>
    </details>
  );
}

export function LandingPage({ returning }: { returning: boolean }) {
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-content">
        Skip to content
      </a>
      <header className="landing-header landing-container">
        <Brand />
        <nav aria-label="Main navigation">
          <a className="landing-button landing-button-small" href="#/workspace">
            {returning ? "Return to workspace" : "Open workspace"}
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main id="landing-content" className="landing-container">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-art" aria-hidden="true">
            <img
              className="landing-hero-graph"
              src={screenshot("graph-overview")}
              srcSet={`${screenshot("graph-overview")} 1x, ${screenshot("graph-overview@2x")} 2x`}
              alt=""
              width={1050}
              height={600}
            />
          </div>
          <h1 id="landing-title" tabIndex={-1}>
            Know which payments
            <br />
            <span>to investigate first.</span>
          </h1>
          <p className="landing-lead">
            RiskFlow helps you find and investigate possible payment fraud. Turn
            a transaction file into a prioritized review list, see how accounts
            and merchants connect, and understand why a payment looks unusual.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-button" href="#/workspace">
              {returning ? "Return to your workspace" : "Explore RiskFlow"}
              <span aria-hidden="true">↗</span>
            </a>
            <a className="landing-text-link" href="#how-it-works">
              How it works <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section
          className="landing-workflow"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="landing-section-heading">
            <h2 id="how-title">How RiskFlow helps you investigate</h2>
            <p>
              Import a transaction file or start with a sample. RiskFlow gives
              you a map of the activity, a list of payments to review, and the
              reasons behind their priority.
            </p>
          </div>
          <ol className="landing-workflow-list">
            <li>
              <h3>
                <span aria-hidden="true">01</span> Explore connected payments
              </h3>
              <figure className="landing-step-image">
                <img
                  src={screenshot("connected-payments")}
                  srcSet={`${screenshot("connected-payments")} 1x, ${screenshot("connected-payments@2x")} 2x`}
                  alt="The RiskFlow graph overview shows connected groups of accounts and merchants."
                  width={390}
                  height={360}
                  loading="lazy"
                />
              </figure>
              <div className="landing-step-copy">
                <p>
                  The graph turns accounts and merchants into objects, with
                  payments connecting them. You can see which accounts visit the
                  same shops, follow repeat purchases, and zoom from a group of
                  accounts down to one payment.
                </p>
                <p>
                  This puts related activity in one view, so you can investigate
                  a payment alongside the history around it.
                </p>
              </div>
            </li>
            <li>
              <h3>
                <span aria-hidden="true">02</span> Choose where to focus
              </h3>
              <figure className="landing-step-image">
                <img
                  src={screenshot("review-queue")}
                  srcSet={`${screenshot("review-queue")} 1x, ${screenshot("review-queue@2x")} 2x`}
                  alt="Payments for review ordered from rank 1 to rank 4 out of 250 payments."
                  width={390}
                  height={344}
                  loading="lazy"
                />
              </figure>
              <div className="landing-step-copy">
                <p>
                  The engine looks at payment amounts, timing and merchant
                  familiarity in the context of earlier activity. It combines
                  these signals to rank payments and suggest which ones deserve
                  a closer look.
                </p>
                <p>
                  Start with the highest-priority payments. Adjust the review
                  queue to examine more or fewer cases, depending on how much
                  you want to investigate.
                </p>
              </div>
            </li>
            <li>
              <h3>
                <span aria-hidden="true">03</span> Inspect the reasons
              </h3>
              <figure className="landing-step-image">
                <img
                  src={screenshot("payment-check")}
                  srcSet={`${screenshot("payment-check")} 1x, ${screenshot("payment-check@2x")} 2x`}
                  alt="The payment explanation shows how individual checks raise or lower review priority."
                  width={390}
                  height={378}
                  loading="lazy"
                />
              </figure>
              <div className="landing-step-copy">
                <p>
                  Select Simulate to replay the transactions. Open a payment to
                  see the observations that raised or lowered its priority, with
                  each factor’s contribution alongside it.
                </p>
                <p>
                  You can check those reasons against the payment’s history and
                  connections before deciding what needs further attention.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section
          className="landing-results"
          id="results"
          aria-labelledby="results-title"
        >
          <div className="landing-section-heading">
            <h2 id="results-title">
              Put more of the fraud at the front of the queue.
            </h2>
            <p>
              RiskFlow ranks payments by review priority, so you can start with
              the ones that need attention most. In these development tests,
              reviewing the highest-ranked 5% captured most of the known fraud.
            </p>
          </div>
          <div className="landing-results-panel">
            <div className="landing-result-heading">
              <span className="landing-selected-label">
                Inside the highest-priority 5% of payments
              </span>
              <span className="landing-result-scope">
                Development evaluation
              </span>
            </div>
            <div className="landing-result-studies">
              <section
                className="landing-result-primary"
                aria-labelledby="ibm-result-title"
              >
                <h3 id="ibm-result-title">IBM TabFormer</h3>
                <p className="landing-study-size">
                  {number(ibm.rows)} simulated payments
                </p>
                <div className="landing-capture-stat">
                  <strong>{percent(ibm.detections / ibm.fraud)}</strong>
                  <span>
                    of known fraud
                    <br />
                    in the top 5%
                  </span>
                </div>
                <p>
                  {ibm.detections} of {ibm.fraud} fraudulent payments within the
                  first {number(ibm.reviews)} places in the ranking.
                </p>
              </section>
              <section
                className="landing-cross-source"
                aria-labelledby="combined-result-title"
              >
                <h3 id="combined-result-title">Across five datasets</h3>
                <p className="landing-study-size">
                  {number(evaluatedRows)} payments, including IBM
                </p>
                <div className="landing-capture-stat">
                  <strong>{percent(meanRecall)}</strong>
                  <span>
                    of known fraud
                    <br />
                    in the top 5%
                  </span>
                </div>
                <p>
                  Each dataset is ranked separately. This is the average share
                  of fraud captured, with each dataset weighted equally.
                </p>
              </section>
            </div>
            <figure
              className="landing-ranking"
              aria-label="Payments ranked from highest to lowest review priority, with the leading 5 percent highlighted"
            >
              <div className="landing-ranking-callout">
                Top 5% selected for review
              </div>
              <div className="landing-ranked-bar" aria-hidden="true">
                <span
                  className="landing-ranked-selected"
                  style={{ width: `${evaluation.reviewFraction * 100}%` }}
                />
              </div>
              <div className="landing-rank-direction" aria-hidden="true">
                <span>Highest priority</span>
                <span className="landing-rank-arrow">&#8594;</span>
                <span>Lowest priority</span>
              </div>
            </figure>
          </div>
        </section>

        <TechnicalDetails />
      </main>
    </div>
  );
}
