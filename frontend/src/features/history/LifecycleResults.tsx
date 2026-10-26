import type { components } from "../../api/generated";
import { PaymentPages } from "../PaymentPages";

export function LifecycleResults({
  report,
}: {
  report: components["schemas"]["LifecycleReport"];
}) {
  return (
    <section aria-label="Transaction lifecycle">
      <h4>Attempts and settled spending</h4>
      <p>
        Amounts below describe recognized purchase flows, not account balances
        or risk scores. Unresolved links and excluded activities make totals
        incomplete. Currencies remain separate.
      </p>
      {report.currencies.map((item) => (
        <div key={item.currency}>
          <strong>{item.currency}</strong>
          <dl>
            <div>
              <dt>Attempts</dt>
              <dd>{item.attemptCount}</dd>
            </div>
            <div>
              <dt>Settled purchases</dt>
              <dd>{(item.settledMinor / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Reconciled refunds</dt>
              <dd>{(item.refundedMinor / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Reconciled reversals</dt>
              <dd>{(item.reversedMinor / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Recognized net outflow</dt>
              <dd>{(item.netOutflowMinor / 100).toFixed(2)}</dd>
            </div>
          </dl>
          <p>
            {item.unresolvedCount} unresolved · {item.excludedCount} excluded
            from purchase accounting
          </p>
        </div>
      ))}
      <details>
        <summary>Lifecycle evidence for every record</summary>
        <PaymentPages
          itemName="lifecycle record"
          items={report.entries}
          identify={(item) =>
            `${item.sourceEventId} ${item.accountId} ${item.transactionId ?? ""}`
          }
        >
          {(item) => (
            <p key={item.eventId}>
              {item.sourceEventId} · {item.kind.replaceAll("_", " ")} ·{" "}
              {item.resolution} · {item.reason}
            </p>
          )}
        </PaymentPages>
      </details>
    </section>
  );
}
