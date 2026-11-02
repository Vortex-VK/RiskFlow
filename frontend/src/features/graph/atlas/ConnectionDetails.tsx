import { CloseIcon } from "../../CloseIcon";
import { useMemo, useState } from "react";
import { money, type Entity } from "../../../domain/types";
import type { SectorConnection } from "./connections";
import { connectionReview } from "./connection-review";

type Props = {
  selected: SectorConnection;
  entityId: string;
  entities: Entity[];
  assessedIds: ReadonlySet<string> | undefined;
  flaggedIds: ReadonlySet<string> | undefined;
  chooseEntity: (id: string) => void;
  close: () => void;
  inspect?: ((id: string) => void) | undefined;
};

function RelatedPayments({
  rows,
  names,
  inspect,
  playback,
}: {
  rows: ReturnType<typeof connectionReview>["rows"];
  names: ReadonlyMap<string, string>;
  inspect: Props["inspect"];
  playback: boolean;
}) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 5) - 1));
  return (
    <>
      <ol className="connection-payments">
        {rows
          .slice(current * 5, current * 5 + 5)
          .map(({ payment: p, assessed, flagged }) => (
            <li key={p.id}>
              <button
                className="connection-payment payment-review-choice"
                data-review-state={
                  flagged ? "review" : assessed ? "no-alert" : "pending"
                }
                disabled={!inspect}
                onClick={() => inspect?.(p.id)}
                title={`Inspect payment ${p.id}`}
                data-payment-id={p.id}
              >
                <span className="connection-payment-heading">
                  <strong>{money(p.amountMinor)}</strong>
                  <span
                    className={
                      flagged ? "connection-flag" : "connection-payment-status"
                    }
                  >
                    {flagged
                      ? "Flagged"
                      : assessed
                        ? "No alert"
                        : playback
                          ? "Not yet assessed"
                          : "Not assessed"}
                  </span>
                </span>
                <span className="connection-participants">
                  {names.get(p.accountId) ?? p.accountId} →{" "}
                  {names.get(p.merchantId) ?? p.merchantId}
                </span>
                <span className="connection-payment-meta">
                  {p.occurredAt.slice(0, 10)} · {p.occurredAt.slice(11, 19)} UTC
                </span>
                <span className="connection-payment-id">{p.id}</span>
              </button>
            </li>
          ))}
      </ol>
      {rows.length > 5 && (
        <nav
          className="connection-pagination"
          aria-label="Related payment pages"
        >
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            {current * 5 + 1}–{Math.min(rows.length, current * 5 + 5)} of{" "}
            {rows.length}
          </span>
          <button
            disabled={(current + 1) * 5 >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}

function ConnectionInspector({
  selected,
  entityId,
  entities,
  assessedIds,
  flaggedIds,
  chooseEntity,
  close,
  inspect,
}: Props) {
  const entity = selected.entities.find((e) => e.id === entityId)!;
  const result = useMemo(
    () =>
      connectionReview(
        [...selected.a.payments, ...selected.b.payments],
        entity,
        assessedIds,
        flaggedIds,
      ),
    [selected, entity, assessedIds, flaggedIds],
  );
  const names = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  );
  const [filter, setFilter] = useState<"flagged" | "all">(() =>
    result.flagged ? "flagged" : "all",
  );
  const activeFilter = result.flagged ? filter : "all";
  const rows =
    activeFilter === "flagged"
      ? result.rows.filter((r) => r.flagged)
      : result.rows;
  return (
    <section
      className="connection-details nopan nowheel"
      aria-label="Connection evidence"
    >
      <header>
        <h2>
          Shared {entity.type}
          <span>{entity.name}</span>
        </h2>
        <button onClick={close} aria-label="Close connection evidence">
          <CloseIcon />
        </button>
      </header>
      <div
        className="connection-summary"
        aria-label="Shared connection summary"
      >
        <div>
          <strong>{result.accounts.toLocaleString()}</strong>
          <span>accounts</span>
        </div>
        <div>
          <strong>{result.rows.length.toLocaleString()}</strong>
          <span>payments</span>
        </div>
        <div className={result.flagged ? "connection-flag" : ""}>
          <strong>{assessedIds ? result.flagged.toLocaleString() : "—"}</strong>
          <span>{assessedIds ? "flagged" : "not assessed"}</span>
        </div>
      </div>
      <p className="connection-scope">
        Related payments in these two groups.{" "}
        {assessedIds
          ? `${result.assessed} of ${result.rows.length} assessed in playback; flags follow the selected threshold.`
          : "Run a simulation to see review decisions."}
      </p>
      <p className="connection-value">
        {money(result.amount)} total
        {result.flagged > 0 && (
          <>
            {" "}
            · <strong>{money(result.flaggedAmount)} flagged</strong>
          </>
        )}
      </p>
      {selected.entities.length > 1 && (
        <label>
          Shared object
          <select
            value={entityId}
            onChange={(e) => chooseEntity(e.target.value)}
          >
            {selected.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.type})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="connection-filters" aria-label="Related payment filters">
        <button
          aria-pressed={activeFilter === "all"}
          onClick={() => setFilter("all")}
        >
          View all payments
        </button>
        {result.flagged > 0 && (
          <button
            aria-pressed={activeFilter === "flagged"}
            onClick={() => setFilter("flagged")}
          >
            View flagged payments
          </button>
        )}
      </div>
      {!rows.length && (
        <p role="status">
          No flagged payments among those assessed so far. View all related
          payments to explore the connection.
        </p>
      )}
      <RelatedPayments
        key={activeFilter}
        rows={rows}
        names={names}
        inspect={inspect}
        playback={!!assessedIds}
      />
      <p className="connection-context">
        {entity.type === "merchant"
          ? "Sharing a merchant is common. Use the payment decisions and timing to decide what deserves investigation."
          : entity.type === "device"
            ? "A shared device links accounts for investigation; device sharing is not an input to the current fraud model."
            : "This account appears in both groups. The connection itself is not a fraud finding."}
      </p>
    </section>
  );
}

export function ConnectionDetails(props: Props) {
  return (
    <ConnectionInspector
      key={`${props.selected.id}:${props.entityId}`}
      {...props}
    />
  );
}
