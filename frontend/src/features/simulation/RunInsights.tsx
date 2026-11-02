import { useMemo } from "react";
import {
  findInvestigationPatterns,
  summarizeInsights,
  type ReviewGroup,
} from "../../domain/runInsights";
import type { DeepReadonly, EventResult } from "../../domain/runs";
import { money, type Scenario } from "../../domain/types";

export function RunInsights({
  events,
  scenario,
  threshold,
  inspectGroup,
}: {
  events: readonly DeepReadonly<EventResult>[];
  scenario: Scenario;
  threshold: number | null;
  inspectGroup: (group: ReviewGroup) => void;
}) {
  const patterns = useMemo(
    () => findInvestigationPatterns(scenario.payments),
    [scenario],
  );
  const insights = useMemo(
    () => summarizeInsights(events, patterns, threshold),
    [events, patterns, threshold],
  );
  const names = useMemo(
    () => new Map(scenario.nodes.map((n) => [n.id, n.name])),
    [scenario],
  );
  return (
    <>
      <section className="run-insights" aria-label="Where alerts concentrate">
        <h3>Where alerts concentrate</h3>
        {insights.flagged ? (
          <>
            <p className="result-scope">
              {insights.accounts.length} accounts · {insights.merchants.length}{" "}
              merchants with alerts
            </p>
            {(
              [
                ["Accounts", insights.accounts],
                ["Merchants", insights.merchants],
              ] as const
            ).map(([label, groups]) => (
              <div key={label}>
                <h4>
                  {label}{" "}
                  <small>Top {Math.min(3, groups.length)} by alert count</small>
                </h4>
                <ul className="insight-list">
                  {groups.slice(0, 3).map((g) => (
                    <li key={g.id}>
                      <button
                        className="concentration-row"
                        onClick={() =>
                          inspectGroup({
                            label: `${label}: ${names.get(g.id) ?? g.id}`,
                            eventIds: events
                              .filter(
                                (e) =>
                                  (label === "Accounts"
                                    ? e.accountId
                                    : e.merchantId) === g.id,
                              )
                              .map((e) => e.eventId),
                          })
                        }
                        title={`Inspect flagged payments for ${names.get(g.id) ?? g.id}`}
                      >
                        <strong>{names.get(g.id) ?? g.id}</strong>
                        <span>
                          {g.eventIds.length} of {g.total} payments flagged
                        </span>
                        <span>{money(g.amount)} flagged</span>
                        <small>
                          {(
                            (g.eventIds.length / insights.flagged) *
                            100
                          ).toFixed(1)}
                          % of all alerts
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : (
          <p>No alerts under the current review policy.</p>
        )}
      </section>
      <section
        className="run-insights"
        aria-label="Patterns worth investigating"
      >
        <h3>Patterns worth investigating</h3>
        <p className="fineprint">
          Observed activity around flagged payments in this CSV. Patterns can
          overlap; they are not explanations of the model’s score.
        </p>
        {insights.patterns.length ? (
          <ul className="insight-list pattern-list">
            {insights.patterns.map((p) => (
              <li key={p.id}>
                <h4>{p.label}</h4>
                <p>{p.description}</p>
                <div>
                  <strong>
                    {p.eventIds.length} flagged · {money(p.amount)}
                  </strong>
                  <button
                    onClick={() =>
                      inspectGroup({
                        label: p.label,
                        eventIds: events
                          .filter((e) =>
                            patterns.matches.get(e.eventId)?.has(p.id),
                          )
                          .map((e) => e.eventId),
                      })
                    }
                    aria-label={`Inspect payments: ${p.label.toLowerCase()}`}
                  >
                    Inspect payments
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {insights.flagged
              ? "No flagged payments match the repeat-attempt, rapid-activity, channel-change or shared-device checks."
              : "No flagged payments to investigate under the current review policy."}
          </p>
        )}
        {!!patterns.missingDevice && (
          <p className="fineprint">
            Shared-device checks unavailable for{" "}
            {patterns.missingDevice.toLocaleString()} payments without usable
            device history.
          </p>
        )}
      </section>
    </>
  );
}
