import { CloseIcon } from "../../CloseIcon";
import { useState } from "react";
import type { Payment } from "../../../domain/types";
import { money } from "../../../domain/types";
import { groupLabel } from "../../../domain/hierarchy";
import { connectionPayments, type SectorConnection } from "./connections";

function sectorNumber(id: string) {
  return id
    .split("/")
    .slice(1)
    .map((n) => Number(n) + 1)
    .join(".");
}
function PaymentRows({
  rows,
  inspect,
}: {
  rows: Payment[];
  inspect?: ((id: string) => void) | undefined;
}) {
  const [page, setPage] = useState(0);
  return (
    <>
      <ol className="connection-payments">
        {rows.slice(page * 4, page * 4 + 4).map((p) => (
          <li key={p.id}>
            {inspect ? (
              <button
                onClick={() => inspect(p.id)}
                title="Locate this payment in the graph"
              >
                {p.id}
              </button>
            ) : (
              <span>{p.id}</span>
            )}
            <span>
              {money(p.amountMinor)} ·{" "}
              {p.occurredAt.replace("T", " ").replace(".000Z", " UTC")}
            </span>
          </li>
        ))}
      </ol>
      {rows.length > 4 && (
        <nav aria-label="Source payment pages">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            {page * 4 + 1}–{Math.min(rows.length, page * 4 + 4)} of{" "}
            {rows.length}
          </span>
          <button
            disabled={(page + 1) * 4 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
export function ConnectionDetails({
  links,
  visible,
  selected,
  entityId,
  choose,
  chooseEntity,
  close,
  inspect,
}: {
  links: SectorConnection[];
  visible: number;
  selected: SectorConnection;
  entityId: string;
  choose: (id: string) => void;
  chooseEntity: (id: string) => void;
  close: () => void;
  inspect?: ((id: string) => void) | undefined;
}) {
  const evidence = connectionPayments(selected, entityId);
  return (
    <section
      className="connection-details nopan nowheel"
      aria-label="Connection evidence"
    >
      <header>
        <strong>Shared activity</strong>
        <button onClick={close} aria-label="Close connection evidence">
          <CloseIcon />
        </button>
      </header>
      <p>
        {visible} of {links.length} links shown at this level. Stronger
        blue-grey links indicate more shared activity.
      </p>
      <label>
        Connection
        <select value={selected.id} onChange={(e) => choose(e.target.value)}>
          {links.map((l) => (
            <option key={l.id} value={l.id}>
              {groupLabel(l.a)} ↔ {groupLabel(l.b)} · {l.entities.length} shared
              objects
            </option>
          ))}
        </select>
      </label>
      <label>
        Shared object
        <select value={entityId} onChange={(e) => chooseEntity(e.target.value)}>
          {selected.entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.type})
            </option>
          ))}
        </select>
      </label>
      <p>
        The highlighted dots are appearances of the same object. This link shows
        shared activity, not a payment between sectors.
      </p>
      {evidence.map(({ group, rows }) => (
        <div key={group.id} className="connection-source">
          <strong>
            Sector {sectorNumber(group.id)} · {rows.length} payments
          </strong>
          <p title={group.reason}>{groupLabel(group)}</p>
          <PaymentRows
            key={`${group.id}:${entityId}`}
            rows={rows}
            inspect={inspect}
          />
        </div>
      ))}
      <small>
        IDs, amounts and UTC dates come from the imported scenario. Position and
        link colour are layout cues, not risk scores.
      </small>
    </section>
  );
}
