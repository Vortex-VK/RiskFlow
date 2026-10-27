import type { components } from "../api/generated";
import type { DeepReadonly } from "../domain/runs";
import "./ContinuousScores.css";

type Score = DeepReadonly<components["schemas"]["EvidenceScore"]>;
export function ScoreValue({ score, label }: { score: Score; label: string }) {
  const highEstimate = score.probabilityAvailable && score.value >= 90;
  return (
    <div
      className={`continuous-score${highEstimate ? " high-estimated-risk" : ""}`}
    >
      <div>
        <strong>{label}</strong>{" "}
        <output>
          {score.value.toFixed(2)}
          {score.probabilityAvailable ? "%" : " / 100"}
        </output>
      </div>
      {highEstimate && (
        <p className="high-estimate-label">High estimated risk · 90%+</p>
      )}
      <meter
        min={0}
        max={100}
        value={score.value}
        aria-label={`${label} score`}
      />
      <p>
        {score.distance >= 0 ? "Above" : "Below"} reference cutoff by{" "}
        {Math.abs(score.distance).toPrecision(4)} margin units.
        {score.probabilityAvailable && (
          <> Reference probability: {score.referenceValue.toFixed(2)}%.</>
        )}
      </p>
      <details>
        <summary>Score calculation</summary>
        <p>
          Raw margin {score.rawMargin.toPrecision(8)}; reference cutoff{" "}
          {score.referenceThreshold.toPrecision(8)}.
          {score.probabilityAvailable
            ? ` A trained probability model maps the raw margin to this estimate. Fitted on ${score.calibrationScope === "ibm_authored_synthetic" ? "IBM and authored" : "IBM"} synthetic data; calibration for your upload is unverified.`
            : " Index = 100 / (1 + exp(−distance)). This historical index is not a fraud probability."}
        </p>
      </details>
    </div>
  );
}

export function ContinuousScores({
  model,
  cards,
  includePrimary = true,
}: {
  model:
    DeepReadonly<components["schemas"]["ModelEvaluation"]> | null | undefined;
  cards:
    DeepReadonly<components["schemas"]["CardPatternScores"]> | null | undefined;
  includePrimary?: boolean;
}) {
  if (!model?.score) return null;
  return (
    <section aria-label="Continuous model scores" className="continuous-scores">
      <h3>
        {model.score.probabilityAvailable
          ? "Estimated fraud probabilities"
          : "Continuous model scores"}
      </h3>
      <p>
        {model.score.probabilityAvailable
          ? `Trained probability estimates based on ${model.score.calibrationScope === "ibm_authored_synthetic" ? "IBM and authored" : "IBM"} synthetic data. Their reliability on your upload is unverified. Highlights mark estimates of 90% or higher, not confirmed fraud or measured accuracy. Each model retains its own reference cutoff.`
          : "Historical evidence indices, not percentages of fraud. 50 marks the original cutoff. Scores from different models are not interchangeable."}
      </p>
      {includePrimary && (
        <ScoreValue
          score={model.score}
          label={
            ["adapted_card", "coverage"].includes(model.score.source)
              ? "Card payments"
              : "Online payments"
          }
        />
      )}
      {cards ? (
        <>
          <ScoreValue score={cards.pattern} label="Card specialist" />
          <ScoreValue score={cards.priority} label="Card prioritizer" />
          <p>
            The specialist is scored independently, including below-cutoff
            cases. Additional review suggestions are suppressed when the primary
            model already alerts.
          </p>
        </>
      ) : (
        <p>
          {["online_specialist", "adapted_online"].includes(model.score.source)
            ? "The card specialist does not score online transactions."
            : model.historyCount < 10
              ? "The card specialist needs at least 10 prior completed purchases."
              : "Card specialist scores were unavailable for this run."}
        </p>
      )}
    </section>
  );
}
