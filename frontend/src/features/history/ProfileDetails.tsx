import type { components } from "../../api/generated";

type Profile = components["schemas"]["EventProfile"];

export function ProfileDetails({
  profile,
  sourceIds,
}: {
  profile: Profile;
  sourceIds: Map<string, string>;
}) {
  return (
    <section aria-label="Historical profile evidence">
      <h4>History used for this assessment</h4>
      <p>
        Account {profile.accountId} · {profile.currency}. Current and later
        transactions are excluded. Completed spending is observed behavior, not
        confirmed legitimate behavior.
      </p>
      {profile.signals.map((signal) => (
        <details key={signal.evaluation.ruleId}>
          <summary>
            {signal.evaluation.ruleId.replaceAll("_", " ")} · {signal.source} ·{" "}
            {signal.evaluation.points} points
          </summary>
          <p>{signal.evaluation.explanation}</p>
          <dl>
            <dt>Population</dt>
            <dd>{signal.population}</dd>
            <dt>Prior samples</dt>
            <dd>
              {signal.sampleCount} · minimum {signal.minimumSamples}, spanning{" "}
              {signal.minimumSpanDays} days
            </dd>
            <dt>History window</dt>
            <dd>
              {signal.windowStart} to before {signal.evaluatedAt}
            </dd>
            <dt>Observed sample dates</dt>
            <dd>
              {signal.firstObservedAt ?? "None"} to{" "}
              {signal.lastObservedAt ?? "None"}
            </dd>
            {signal.medianMinor != null && (
              <>
                <dt>
                  {signal.source === "configured"
                    ? "Configured amount"
                    : "Lower median amount"}
                </dt>
                <dd>
                  {(signal.medianMinor / 100).toFixed(2)} {profile.currency}
                </dd>
              </>
            )}
            {signal.medianAbsoluteDeviationMinor != null && (
              <>
                <dt>Median absolute deviation</dt>
                <dd>
                  {(signal.medianAbsoluteDeviationMinor / 100).toFixed(2)}{" "}
                  {profile.currency} · descriptive, adds no points
                </dd>
              </>
            )}
            {!!signal.baselineValues?.length && (
              <>
                <dt>Previously observed values</dt>
                <dd>{signal.baselineValues.join(", ")}</dd>
              </>
            )}
            {signal.merchantRange && (
              <>
                <dt>Previously observed merchant amount range</dt>
                <dd>
                  Up to {(signal.merchantRange.maximumMinor / 100).toFixed(2)}{" "}
                  {profile.currency}
                  {" · "}
                  {signal.merchantRange.sampleCount} completed purchases on{" "}
                  {signal.merchantRange.distinctDays} dates at merchant{" "}
                  {signal.merchantRange.merchantId}, category{" "}
                  {signal.merchantRange.category}. Observed spending does not
                  establish legitimacy.
                </dd>
                <dt>Merchant range observations</dt>
                <dd>
                  {signal.merchantRange.firstObservedAt} to{" "}
                  {signal.merchantRange.lastObservedAt}
                </dd>
                <dt>Merchant range evidence</dt>
                <dd>
                  {signal.merchantRange.evidenceIds
                    .map((id) => sourceIds.get(id) ?? id)
                    .join(", ")}
                </dd>
                <dt>Merchant range evidence hash</dt>
                <dd>{signal.merchantRange.evidenceHash}</dd>
              </>
            )}
            {signal.evaluation.ruleId === "new_device" && (
              <>
                <dt>Device trust</dt>
                <dd>
                  {signal.trustState}
                  {signal.trustProvenance &&
                    ` · ${signal.trustProvenance} · effective ${signal.trustEffectiveAt}`}
                </dd>
                <dt>Trust assertion record</dt>
                <dd>
                  {signal.trustEventId
                    ? (sourceIds.get(signal.trustEventId) ??
                      signal.trustEventId)
                    : "No trust assertion; familiarity alone does not establish trust"}
                </dd>
              </>
            )}
          </dl>
          <p>
            Evidence records: {signal.evidenceCount}. Showing up to 50:{" "}
            {signal.evidenceIds
              .map((id) => sourceIds.get(id) ?? id)
              .join(", ") || "None"}
            .
          </p>
          <p>Evidence hash: {signal.evidenceHash}</p>
        </details>
      ))}
    </section>
  );
}
