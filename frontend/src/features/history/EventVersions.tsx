import { useState } from "react";
import type { EventPage } from "../../api/decodeAssessment";
import { historyApi } from "../../api/history";

export function EventVersions({
  datasetId,
  eventId,
  revision,
}: {
  datasetId: string;
  eventId: string;
  revision: number;
}) {
  const [page, setPage] = useState<EventPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(offset: number) {
    setBusy(true);
    setError("");
    try {
      setPage(await historyApi.versions(datasetId, eventId, revision, offset));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load versions.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button disabled={busy} onClick={() => void load(0)}>
        Show record versions
      </button>
      {error && <p role="alert">{error}</p>}
      {page && (
        <>
          <p>{page.total} retained versions</p>
          {page.items.map((item) => (
            <details key={item.acceptedRevision}>
              <summary>
                Revision {item.acceptedRevision} ·{" "}
                {item.correctionReason ?? "Original record"}
              </summary>
              <p>
                Recorded {item.recordedAt} · Source availability{" "}
                {item.event.sourceAvailableAt ?? "unknown"}
              </p>
              <dl>
                {Object.entries(item.event.sourceFields).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value || "Not supplied"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
          <button
            disabled={busy || page.offset === 0}
            onClick={() => void load(Math.max(0, page.offset - 50))}
          >
            Previous versions
          </button>
          <button
            disabled={busy || page.offset + page.items.length >= page.total}
            onClick={() => void load(page.offset + 50)}
          >
            Next versions
          </button>
        </>
      )}
    </div>
  );
}
