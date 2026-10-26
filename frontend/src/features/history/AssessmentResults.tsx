import type { AssessmentRun } from "../../api/decodeAssessment";
import { assessmentText } from "../../domain/model";
import { useState } from "react";
import { useSimulation } from "../../state/simulation";
import { PaymentPages } from "../PaymentPages";
import { CardPatternDetails } from "../CardPatternDetails";
import { ContinuousScores } from "../ContinuousScores";
import { LifecycleResults } from "./LifecycleResults";
import { ProfileDetails } from "./ProfileDetails";

export function AssessmentResults({ run }: { run: AssessmentRun }) {
  const behavioral = run.analysisMode === "behavioral";
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focused = run.assessments.find((item) => item.eventId === focusedId);
  const profiles = new Map(
    run.profiles?.events.map((profile) => [profile.eventId, profile]),
  );
  const sourceIds = new Map(
    run.assessments.map((item) => [item.eventId, item.sourceEventId]),
  );
  return (
    <section aria-label="Retained assessment results">
      <h3>Assessment · revision {run.revision}</h3>
      <p>{assessmentText(run.knowledgeLimitation)}</p>
      {run.simulation?.warnings
        .filter((w) => w.code === "card_pattern_unavailable")
        .map((w) => (
          <p key={w.code} role="status">
            {assessmentText(w.message)}
          </p>
        ))}
      {run.knowledgeCutoff && (
        <p>Source availability cutoff: {run.knowledgeCutoff}</p>
      )}
      {run.lifecycle && <LifecycleResults report={run.lifecycle} />}
      <p>
        {["complete", "partial", "not_assessed"]
          .map(
            (status) =>
              `${run.assessments.filter((item) => item.coverage === status).length} ${status.replaceAll("_", " ")}`,
          )
          .join(" · ")}
      </p>
      {!behavioral && (
        <p>
          {run.assessments.some((item) => item.model) && (
            <>
              Benchmark comparison. Matching fields do not validate predictions
              for your data source.{" "}
            </>
          )}
          No alert means the assessment did not flag this purchase. It does not
          establish that a transaction is safe.
        </p>
      )}
      {run.simulation && (
        <button onClick={() => useSimulation.getState().openAssessment(run)}>
          Replay assessed purchases
        </button>
      )}
      {["assessment-v2.8", "assessment-v2.9"].includes(
        run.assessmentVersion,
      ) && (
        <p>
          {run.assessments.filter((item) => item.cardPattern).length} additional
          card reviews. These experimental suggestions are separate from model
          alerts and metrics.{" "}
          {
            run.assessments.filter(
              (item) => item.cardPattern?.priority?.level === "prioritized",
            ).length
          }{" "}
          prioritized; all remaining leads are retained.
        </p>
      )}
      <details>
        <summary>Reproducibility details</summary>
        <p>
          Input: {run.inputHash}
          <br />
          Analysis: {run.analysisHash}
          <br />
          {run.assessmentVersion} · {run.adapterVersion} · {run.taxonomyVersion}
        </p>
        {run.profiles && (
          <>
            <p>
              Profile configuration · {run.profiles.config.version}. Initial
              policy hypotheses; not calibrated fraud probabilities.
            </p>
            <pre>{JSON.stringify(run.profiles.config, null, 2)}</pre>
          </>
        )}
      </details>
      <PaymentPages
        items={run.assessments}
        identify={(item) => item.sourceEventId}
      >
        {(item) => (
          <details key={item.eventId} id={`assessment-${item.eventId}`}>
            <summary>
              {item.sourceEventId} ·{" "}
              {item.behavioral
                ? "Behavioral observations"
                : item.recommendation.replaceAll("_", " ")}{" "}
              ·{" "}
              {item.model
                ? `${item.model.score ? `${item.model.score.value.toFixed(2)}${item.model.score.probabilityAvailable ? "%" : "/100"}` : "Score unavailable"} · partial context`
                : item.score === null
                  ? "Not scored"
                  : `${item.score}/100`}
              {item.totalRules === 6 &&
                ` · ${item.evaluatedRules}/6 legacy rules`}
              {item.cardPattern && " · Additional card review"}
              {item.cardPattern?.priority &&
                ` · ${item.cardPattern.priority.level}`}
            </summary>
            <p>{assessmentText(item.reason ?? "")}</p>
            <ContinuousScores model={item.model} cards={item.cardScores} />
            <CardPatternDetails review={item.cardPattern} />
            {item.behavioral && (
              <>
                <p>
                  USD {item.behavioral.observedAmount} ·{" "}
                  {item.behavioral.occurredAt}
                </p>
                <p>
                  {item.behavioral.historyCount} prior observations within 30
                  days · {item.behavioral.prior24HCount} in the prior 24 hours
                </p>
                <p>
                  {item.behavioral.medianAmount === null
                    ? "No prior amount comparison is available."
                    : `Prior median: USD ${item.behavioral.medianAmount}. This amount is ${item.behavioral.amountRatio!.toFixed(2)} times the median.`}
                </p>
                {!item.behavioral.merchantIdentityAvailable && (
                  <p>Merchant identity was not supplied.</p>
                )}
                {item.behavioral.timePrecision === "date" && (
                  <p>
                    Date-only history ends on the previous day; subday timing is
                    unavailable.
                  </p>
                )}
                {item.behavioral.evidenceIds.length > 0 && (
                  <p>
                    {item.behavioral.evidenceTruncated
                      ? "Recent supporting records (partial list): "
                      : "Supporting records: "}
                    {item.behavioral.evidenceIds.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ", "}
                        <button onClick={() => setFocusedId(id)}>
                          {sourceIds.get(id) ?? id}
                        </button>
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}
            {item.model && (
              <p>
                {item.model.historyCount} prior completed purchases ·{" "}
                {item.model.detectionPaths.join(", ") ||
                  "No alert path triggered"}
              </p>
            )}
            {item.signals.map((signal) => (
              <p key={signal.ruleId}>
                {signal.ruleId.replaceAll("_", " ")} ·{" "}
                {signal.available ? "Evaluated" : signal.reason}
              </p>
            ))}
            {profiles.has(item.eventId) && (
              <ProfileDetails
                profile={profiles.get(item.eventId)!}
                sourceIds={sourceIds}
              />
            )}
          </details>
        )}
      </PaymentPages>
      {focused?.behavioral && (
        <section aria-label="Supporting observation">
          <h4>Supporting record {focused.sourceEventId}</h4>
          <p>
            USD {focused.behavioral.observedAmount} ·{" "}
            {focused.behavioral.occurredAt}
          </p>
          <p>
            This record contributed to the selected observation's prior history.
          </p>
          <button onClick={() => setFocusedId(null)}>
            Close supporting record
          </button>
        </section>
      )}
    </section>
  );
}
