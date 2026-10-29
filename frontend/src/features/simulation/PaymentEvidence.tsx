import { useEffect, useState, type ReactNode } from "react";
import {
  fetchExplanation,
  type PaymentExplanation,
} from "../../api/paymentExplanation";
import type { DeepReadonly, EventResult } from "../../domain/runs";
import type { Scenario } from "../../domain/types";
import { needsReview } from "../../domain/review";
import { StackEvidence, type QueueContext } from "./StackEvidence";
import { ContributionExplanation } from "./ContributionExplanation";

const cache = new WeakMap<Scenario, Map<string, PaymentExplanation>>();

function ModelExplanation({
  scenario,
  event,
  threshold,
  evidence,
  additionalDetails,
}: {
  scenario: Scenario;
  event: DeepReadonly<EventResult>;
  threshold: number | null;
  evidence: ReactNode;
  additionalDetails: ReactNode;
}) {
  const [data, setData] = useState(() =>
    cache.get(scenario)?.get(event.eventId),
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const supported = event.model?.version === "ml-upload-v9";
  useEffect(() => {
    if (data || !supported) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    void fetchExplanation(scenario, event, signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const entries =
          cache.get(scenario) ?? new Map<string, PaymentExplanation>();
        // Keep only a small set of inspected payments in this run's memory cache.
        if (entries.size >= 30) entries.delete(entries.keys().next().value!);
        entries.set(event.eventId, result);
        cache.set(scenario, entries);
        setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Explanation unavailable.",
          );
      });
    return () => controller.abort();
  }, [scenario, event, data, supported, attempt]);

  return (
    <section className="model-explanation" aria-label="Model explanation">
      <h3>Model explanation</h3>
      {!supported ? (
        <p>
          Feature attribution is available for new RiskFlow assessments. This
          saved model version records scores only.
        </p>
      ) : error ? (
        <>
          <p role="status">{error}</p>
          <button
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Retry explanation
          </button>
        </>
      ) : !data ? (
        <p role="status">Calculating this payment’s contributing factors…</p>
      ) : (
        <ContributionExplanation
          evidence={evidence}
          additionalDetails={additionalDetails}
          data={data}
          cutoff={threshold ?? event.model?.score?.referenceValue}
          review={needsReview(event, threshold)}
          preview={threshold !== null}
        />
      )}
      {!data && (
        <>
          {evidence}
          <details>
            <summary>Calculation and model-score details</summary>
            {additionalDetails}
          </details>
        </>
      )}
    </section>
  );
}

export function PaymentEvidence({
  scenario,
  event,
  threshold,
  truth,
  queue,
}: {
  scenario: Scenario;
  event: DeepReadonly<EventResult>;
  threshold: number | null;
  truth: string | undefined;
  queue?: QueueContext | undefined;
}) {
  const model = event.model!;
  if (model.ranking && queue) {
    return <StackEvidence scenario={scenario} event={event} queue={queue} />;
  }
  const score = model.score;
  const payment = scenario.payments.find((p) => p.id === event.eventId);
  const input = payment?.modelInput;
  const review = needsReview(event, threshold);
  const cutoff = threshold ?? score?.referenceValue;
  const earlierDeviceAccounts = new Set(
    event.deviceId
      ? scenario.payments
          .filter(
            (p) =>
              p.deviceId === event.deviceId &&
              p.occurredAt < event.occurredAt &&
              p.accountId !== event.accountId,
          )
          .map((p) => p.accountId)
      : [],
  );
  const evidence = (
    <section aria-label="Available evidence">
      <h4>Available evidence</h4>
      <dl className="facts evidence-facts">
        <div>
          <dt>Channel</dt>
          <dd>
            {input?.channel.replace(" Transaction", "") ?? "Not supplied"}
          </dd>
        </div>
        <div>
          <dt>Merchant category code</dt>
          <dd>{input?.mcc ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>
            {input
              ? input.completed
                ? "Completed"
                : "Not completed"
              : "Not supplied"}
          </dd>
        </div>
        <div>
          <dt>Earlier completed purchases</dt>
          <dd>{model.historyCount.toLocaleString()}</dd>
        </div>
        {!!earlierDeviceAccounts.size && (
          <div>
            <dt>Other accounts previously using this device</dt>
            <dd>{earlierDeviceAccounts.size}</dd>
          </div>
        )}
      </dl>
      {!!earlierDeviceAccounts.size && (
        <p className="fineprint">
          Device links support investigation; device identity is not used by
          this model.
        </p>
      )}
    </section>
  );
  const additionalDetails = (
    <>
      {" "}
      {score && (
        <>
          <h4>Decision score details</h4>
          <p>
            The final model combines transaction context and earlier detector
            outputs. Its score is converted to the estimated probability shown
            above.
          </p>
          <dl className="facts">
            <div>
              <dt>Decision score</dt>
              <dd>{score.rawMargin.toFixed(4)}</dd>
            </div>
            <div>
              <dt>Default review boundary</dt>
              <dd>{score.referenceThreshold.toFixed(4)}</dd>
            </div>
            <div>
              <dt>
                Distance {score.distance >= 0 ? "above" : "below"} default
                boundary
              </dt>
              <dd>{Math.abs(score.distance).toFixed(4)}</dd>
            </div>
          </dl>
          <p className="fineprint">
            These are uncalibrated model score units. The default boundary
            belongs to the {score.source.includes("online") ? "online" : "card"}{" "}
            route; a preview threshold does not change it.
          </p>
        </>
      )}{" "}
      <h4>Assessment scope</h4>
      <AssessmentScope truth={truth} />
    </>
  );
  return (
    <>
      <section aria-label="Review decision">
        <h3>Review decision</h3>
        <p>
          {score?.probabilityAvailable && cutoff !== undefined
            ? `${review ? "Meets" : "Below"} ${cutoff.toFixed(2)}% threshold · ${review ? "For review." : "No alert."}`
            : model.alert
              ? "The model’s fixed alert policy sent this payment for review."
              : "The model’s fixed alert policy did not flag this payment."}
        </p>
      </section>
      <ModelExplanation
        key={event.eventId}
        evidence={evidence}
        additionalDetails={additionalDetails}
        scenario={scenario}
        event={event}
        threshold={threshold}
      />
    </>
  );
}

export function AssessmentScope({ truth }: { truth: string | undefined }) {
  return (
    <>
      {" "}
      <p>
        RiskFlow prioritizes payments for investigation using transaction
        behavior and prior history. An alert is a review recommendation; it does
        not confirm fraud or authorize a payment.
      </p>
      <p>
        Model training and probability calibration use IBM and authored
        synthetic data. Validate performance on a new source before using it for
        automated decisions. Confirmed merchant-fraud feedback is not available
        in this assessment.
      </p>
      <p className="fineprint">
        Synthetic truth label: {truth || "Unlabeled"}. Labels are excluded from
        scoring.
      </p>
    </>
  );
}
