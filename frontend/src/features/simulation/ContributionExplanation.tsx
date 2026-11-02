import type { ReactNode } from "react";
import { ProbabilityPlot } from "./ProbabilityPlot";
import type { PaymentExplanation } from "../../api/paymentExplanation";
import calibration from "../../../../contracts/adaptation-spec.json";
import {
  probabilityWalkthrough,
  signedContribution,
} from "../../domain/contributionBreakdown";
import { featureLabels } from "./explanationLabels";

export function ContributionExplanation({
  data,
  cutoff,
  review,
  preview,
  evidence,
  additionalDetails,
}: {
  data: PaymentExplanation;
  cutoff: number | undefined;
  review: boolean;
  preview: boolean;
  evidence: ReactNode;
  additionalDetails: ReactNode;
}) {
  const breakdown = probabilityWalkthrough(data);
  return (
    <>
      <ProbabilityPlot
        data={data}
        cutoff={cutoff}
        review={review}
        preview={preview}
      />
      {evidence}
      <details>
        <summary>Calculation and model-score details</summary>
        <p>
          Tree SHAP explains the final decision model. Earlier detector
          assessments are combined inputs; their underlying factors are not
          separated here. Missing inputs can also contribute through the model’s
          missing-value behavior.
        </p>
        <p>
          The starting estimate is the calibrated model baseline, not the
          dataset’s fraud rate. Each step adds a SHAP contribution to the
          running model score, then converts that score to probability.
          Reordering or regrouping steps changes their percentage-point sizes,
          but leaves the final probability unchanged.
        </p>
        <p>
          Baseline {data.baseValue.toFixed(4)} + all contributions{" "}
          {(data.rawMargin - data.baseValue).toFixed(4)} = final score{" "}
          {data.rawMargin.toFixed(4)}.
        </p>
        <p className="probability-formula">
          Probability = 100 ÷ (1 + exp(−z)), where z ={" "}
          {calibration.slope.toFixed(6)} × score +{" "}
          {calibration.intercept.toFixed(6)}.
        </p>
        <p>
          For this payment: z ={" "}
          {(calibration.slope * data.rawMargin + calibration.intercept).toFixed(
            6,
          )}{" "}
          → {data.probability.toFixed(2)}%. The calculation uses full precision
          and limits z to −{calibration.logit_clip}…{calibration.logit_clip} for
          numerical stability.
        </p>
        <p>
          The original contributions below are in model-score units, not
          percentage points. The displayed walkthrough shows the largest
          contributions, includes both directions when present, and groups the
          remaining factors.
        </p>
        {additionalDetails}
        <h4>All model-score contributions</h4>
        <dl className="facts">
          {breakdown.ranked.map((row) => (
            <div key={row.feature}>
              <dt>{featureLabels[row.feature] ?? row.feature}</dt>
              <dd>{signedContribution(row.contribution)}</dd>
            </div>
          ))}
        </dl>
        <a
          href="https://catboost.ai/docs/en/concepts/shap-values"
          target="_blank"
          rel="noreferrer"
        >
          How Tree SHAP contributions are calculated
        </a>
      </details>
    </>
  );
}
