import { useState } from "react";
import type { ImportPreview } from "../../api/decodeAssessment";
import type { components } from "../../api/generated";
import { PaymentPages } from "../PaymentPages";

export function CorrectionReview({
  preview,
  busy,
  resolve,
}: {
  preview: ImportPreview;
  busy: boolean;
  resolve: (request: components["schemas"]["CorrectionRequest"]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const conflicts = preview.rows.filter(
    (row) => row.disposition === "conflict",
  );
  if (!conflicts.length) return null;
  return (
    <section aria-label="Review corrections">
      <h4>Review changed records</h4>
      <p>
        Select the changes you intend to accept. Previous versions and saved
        assessments remain available. Unresolved conflicts still prevent the
        import from committing.
      </p>
      <p>
        Amount values below use hundredths of the source currency: 4000 means
        40.00.
      </p>
      <PaymentPages
        itemName="correction"
        items={conflicts}
        identify={(row) => row.sourceEventId ?? ""}
      >
        {(row) => (
          <div key={row.row}>
            <label>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(row.eventId!)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...new Set([...current, row.eventId!])]
                      : current.filter((id) => id !== row.eventId),
                  )
                }
              />
              Accept correction for {row.sourceEventId}
            </label>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Previous</th>
                  <th>Proposed</th>
                </tr>
              </thead>
              <tbody>
                {row.changes?.map((change) => (
                  <tr key={change.field}>
                    <th>{change.field.replaceAll("_", " ")}</th>
                    <td>{change.before}</td>
                    <td>{change.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PaymentPages>
      <label>
        Correction reason
        <input
          value={reason}
          maxLength={1000}
          disabled={busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        disabled={busy || !selected.length || !reason.trim()}
        onClick={() =>
          resolve({
            expectedRevision: preview.expectedRevision,
            eventIds: selected,
            reason: reason.trim(),
          })
        }
      >
        Preview selected corrections
      </button>
    </section>
  );
}
