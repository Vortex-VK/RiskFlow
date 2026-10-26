import { CloseIcon } from "../CloseIcon";
import { useEffect, useRef } from "react";
import { useViewport } from "@xyflow/react";
import type { Selection } from "../../domain/types";
import { money, orderedPayments } from "../../domain/types";
import { affectedPayments, paymentDefault } from "../../domain/commands";
import { guarded, useWorkspace } from "../../state/workspace";
import { PaymentPages } from "../PaymentPages";
import { Presence } from "../Presence";
import { RecordForm } from "./RecordForm";
import type { Draft } from "./draft";
import styles from "./Editor.module.css";

export function Inspector({
  editSession,
  draft,
  close,
  remove,
  create,
  nearby = false,
}: {
  editSession: number;
  draft: Draft | null;
  close: () => void;
  remove: () => void;
  create: (draft: Draft) => void;
  nearby?: boolean;
}) {
  const viewport = useViewport();
  const state = useWorkspace();
  const document = state.document!;
  const selection: Selection = draft
    ? { kind: draft.kind, id: draft.record.id }
    : state.selection;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [selection?.id]);
  if (!selection) return <Presence>{null}</Presence>;
  const node =
    selection.kind === "node"
      ? document.scenario.nodes.find((n) => n.id === selection.id)
      : null;
  const point = node ? document.view.positions[node.id] : undefined;
  const anchor =
    nearby && point && window.innerWidth > 700
      ? {
          left: Math.max(
            20,
            Math.min(
              window.innerWidth - 340,
              point.x * viewport.zoom + viewport.x + 65,
            ),
          ),
          top: Math.max(
            85,
            Math.min(
              window.innerHeight -
                Math.min(440, window.innerHeight - 190) -
                120,
              point.y * viewport.zoom + viewport.y - 80,
            ),
          ),
          right: "auto",
          maxHeight: "min(440px, calc(100dvh - 190px))",
        }
      : undefined;
  const payments = affectedPayments(document, selection);
  const addPayment = () => {
    const first = payments[0];
    if (first)
      guarded(() =>
        create({
          kind: "payment",
          record: paymentDefault(document, first.accountId, first.merchantId),
        }),
      );
  };
  return (
    <Presence>
      <aside
        className="card inspector"
        aria-label="Selection details"
        style={anchor}
      >
        <button className="close" aria-label="Close details" onClick={close}>
          <CloseIcon />
        </button>
        <div className="kicker">
          {draft ? "Add " : ""}
          {node?.type ||
            (selection.kind === "group"
              ? "Payment connection"
              : selection.kind)}
        </div>
        <h2 ref={heading} tabIndex={-1}>
          {node?.name ||
            (selection.kind === "group"
              ? `${payments.length} payments`
              : draft
                ? "New " + draft.kind
                : selection.kind === "payment"
                  ? money(payments[0]?.amountMinor || 0)
                  : "Context relationship")}
        </h2>
        {state.dirty && <p className={styles.dirty}>Unapplied edits</p>}
        {selection.kind !== "group" && (
          <RecordForm
            key={editSession}
            document={document}
            selection={selection}
            draft={draft}
            close={close}
          />
        )}
        {!draft && payments.length > 0 && (
          <details open={selection.kind === "group"}>
            <summary>
              {payments.length} related payment
              {payments.length === 1 ? "" : "s"} · UTC
            </summary>
            <div className={styles.payments}>
              <PaymentPages
                key={`${selection.kind}:${selection.id}`}
                items={orderedPayments(payments)}
                identify={(p) => p.id}
              >
                {(p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      guarded(() => state.select({ kind: "payment", id: p.id }))
                    }
                  >
                    <span>
                      {p.id.length > 18 ? p.id.slice(0, 8) : p.id}
                      <small>{p.occurredAt.slice(11, 23)}</small>
                    </span>
                    <strong>{money(p.amountMinor)}</strong>
                  </button>
                )}
              </PaymentPages>
            </div>
          </details>
        )}
        {selection.kind === "group" && (
          <button className="wide" onClick={addPayment}>
            Add another payment
          </button>
        )}
        {!draft && (
          <button className="danger wide" onClick={remove}>
            {selection.kind === "group"
              ? `Remove all ${payments.length} payments`
              : `Delete ${node?.type || selection.kind}`}
          </button>
        )}
      </aside>
    </Presence>
  );
}
