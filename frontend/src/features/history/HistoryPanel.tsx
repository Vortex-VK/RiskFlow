import { CloseIcon } from "../CloseIcon";
import { useEffect, useRef, useState } from "react";
import type { components } from "../../api/generated";
import type {
  Dataset,
  EventPage,
  ImportPreview,
  RunSummary,
} from "../../api/decodeAssessment";
import { historyApi } from "../../api/history";
import { parseCsv } from "../../domain/csv";
import { decodeCsvBytes } from "../../domain/csv-values";
import {
  MAX_RETAINED_IMPORT_BYTES,
  MAX_RETAINED_IMPORT_ROWS,
} from "../../domain/limits";
import type { Document } from "../../domain/types";
import { useAnalysis } from "../../state/analysis";
import { PaymentPages } from "../PaymentPages";
import { AssessmentResults } from "./AssessmentResults";
import { CorrectionReview } from "./CorrectionReview";
import { EventVersions } from "./EventVersions";
import "./history.css";

type ImportOptions = components["schemas"]["ImportOptions"];
const fields = [
  "source_event_id",
  "account_id",
  "occurred_at",
  "amount",
  "debit",
  "credit",
  "time",
  "year",
  "month",
  "day",
  "user",
  "card",
  "card_errors",
  "channel",
  "mcc",
  "merchant_city",
  "merchant_state",
  "merchant_zip",
  "currency",
  "direction",
  "activity_type",
  "status",
  "merchant_id",
  "merchant_name",
  "source_category",
  "merchant_country",
  "device_id",
  "location_id",
  "location_country",
  "source_available_at",
  "underlying_transaction_id",
  "lifecycle_kind",
  "related_event_id",
  "device_known_from",
  "device_trust_state",
  "device_trust_effective_at",
  "device_trust_provenance",
  "location_known_from",
  "typical_amount",
  "usual_countries",
  "usual_categories",
];
const defaults: ImportOptions = {
  columns: {},
  delimiter: "auto",
  decimalSeparator: ".",
  dateOrder: "iso",
  utcOffsetMinutes: null,
  declaredOutgoing: false,
  declaredPurchases: false,
};

export function HistoryPanel({
  close,
  fork,
}: {
  close: () => void;
  fork: (document: Document) => void;
}) {
  const selected = useAnalysis();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [events, setEvents] = useState<EventPage | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [upload, setUpload] = useState<{
    filename: string;
    contentBase64: string;
    headers: string[];
  } | null>(null);
  const [options, setOptions] = useState<ImportOptions>(defaults);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historical, setHistorical] = useState(false);
  const [cutoff, setCutoff] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"model" | "behavioral">(
    "behavioral",
  );
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;
    historyApi
      .list()
      .then((value) => {
        if (token === generation.current) setDatasets(value);
      })
      .catch((error) => {
        if (token === generation.current) setError(String(error));
      })
      .finally(() => {
        if (token === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (selected.datasetId) {
      const id = selected.datasetId;
      Promise.all([historyApi.get(id), historyApi.runs(id)])
        .then(async ([dataset, runs]) => {
          const page = await historyApi.events(id, dataset.revision);
          if (active) {
            setDataset(dataset);
            setRuns(runs);
            setEvents(page);
          }
        })
        .catch((error) => {
          if (active) setError(String(error));
        });
    }
    return () => {
      active = false;
    };
  }, [selected.datasetId]);

  async function perform(action: (current: () => boolean) => Promise<void>) {
    if (busy) return;
    const token = generation.current;
    const current = () => token === generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action(current);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "History request failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refresh(id: string) {
    const next = await historyApi.get(id);
    const [page, runs, datasets] = await Promise.all([
      historyApi.events(id, next.revision),
      historyApi.runs(id),
      historyApi.list(),
    ]);
    setDataset(next);
    setEvents(page);
    setRuns(runs);
    setDatasets(datasets);
  }

  function select(id: string | null) {
    setDataset(null);
    setEvents(null);
    setRuns([]);
    setUpload(null);
    setPreview(null);
    setError("");
    setNotice("");
    setHistorical(false);
    setCutoff("");
    useAnalysis.setState({ datasetId: id, run: null });
  }

  async function read(file: File) {
    setPreview(null);
    setUpload(null);
    setOptions(defaults);
    if (file.size > MAX_RETAINED_IMPORT_BYTES)
      throw new Error("CSV files must be at most 5 MiB.");
    const buffer = await file.arrayBuffer();
    const table = parseCsv(decodeCsvBytes(buffer), {
      maxRows: MAX_RETAINED_IMPORT_ROWS,
      maxCharacters: MAX_RETAINED_IMPORT_BYTES,
    });
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 32768)
      chunks.push(
        String.fromCharCode(...bytes.subarray(offset, offset + 32768)),
      );
    setUpload({
      filename: file.name,
      contentBase64: btoa(chunks.join("")),
      headers: table.headers,
    });
  }

  function updateOptions(next: ImportOptions) {
    setOptions(next);
    setPreview(null);
  }
  const run = selected.run;

  return (
    <section
      className="card history-panel"
      aria-label="Saved datasets"
      aria-busy={busy}
    >
      <button
        className="close"
        aria-label="Close saved datasets"
        onClick={close}
      >
        <CloseIcon />
      </button>
      <div className="kicker">Retained transaction history</div>
      <h2>Saved datasets</h2>
      <p>
        Temporary CSV imports stay in the sandbox. Open a dataset here to retain
        source records and frozen assessments across sessions.
      </p>
      <label>
        Open dataset
        <select
          disabled={busy}
          value={selected.datasetId ?? ""}
          onChange={(event) => select(event.target.value || null)}
        >
          <option value="">Choose a dataset</option>
          {datasets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.eventCount} records
            </option>
          ))}
        </select>
      </label>
      {!selected.datasetId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async (current) => {
              const created = await historyApi.create(
                name.trim(),
                source.trim(),
              );
              if (!current()) return;
              setDatasets([...datasets, created]);
              select(created.id);
            });
          }}
        >
          <h3>Create a dataset</h3>
          <label>
            Dataset name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Source namespace
            <input
              required
              maxLength={200}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="e.g. personal-bank-export"
            />
          </label>
          <p>
            Use a stable source name for exports that share account and
            transaction IDs. A dataset has one source namespace.
          </p>
          <button disabled={busy || !name.trim() || !source.trim()}>
            Create dataset
          </button>
        </form>
      )}
      {selected.datasetId && !dataset && <p>Opening dataset…</p>}
      {dataset && (
        <>
          <h3>{dataset.name}</h3>
          <p>
            {dataset.eventCount} retained records · revision {dataset.revision}{" "}
            · source {dataset.sourceNamespace}
          </p>
          <div className="history-actions">
            <label>
              Analysis mode
              <select
                value={analysisMode}
                disabled={busy}
                onChange={(event) =>
                  setAnalysisMode(event.target.value as "model" | "behavioral")
                }
              >
                <option value="model">Fraud assessment comparison</option>
                <option value="behavioral">
                  Behavioral observations · no fraud score
                </option>
              </select>
            </label>
            <button
              disabled={
                busy ||
                dataset.eventCount === 0 ||
                (historical && !cutoff.trim())
              }
              onClick={() =>
                void perform(async (current) => {
                  const run = await historyApi.assess(
                    dataset.id,
                    dataset.revision,
                    historical ? cutoff.trim() : undefined,
                    analysisMode,
                  );
                  if (!current()) return;
                  useAnalysis.setState({ run });
                  await refresh(dataset.id);
                })
              }
            >
              {analysisMode === "behavioral"
                ? "Describe purchase history"
                : "Assess retained history"}
            </button>
            <button
              disabled={busy || dataset.eventCount === 0}
              onClick={() =>
                void perform(async (current) => {
                  const document = await historyApi.document(
                    dataset.id,
                    dataset.revision,
                  );
                  if (!current()) return;
                  fork(document);
                  close();
                })
              }
            >
              Create editable sandbox copy
            </button>
          </div>
          {analysisMode === "behavioral" && (
            <p>
              Describes positive outgoing USD purchases using this dataset's
              prior observations. Merchant, channel, MCC and completion status
              are optional. Unsupported activity remains listed with a reason.
              This mode produces no fraud alerts or probabilities.
            </p>
          )}
          {analysisMode === "model" && (
            <p>
              Experimental model alerts trained on IBM and authored synthetic
              data. Matching columns do not establish fraud-detection accuracy
              on this source. New runs include estimated fraud probabilities
              fitted on IBM and authored synthetic data. Calibration for your
              upload is unverified.
            </p>
          )}
          <details>
            <summary>Historical availability</summary>
            <label>
              <input
                type="checkbox"
                checked={historical}
                disabled={busy}
                onChange={(event) => setHistorical(event.target.checked)}
              />
              Use a source-availability cutoff
            </label>
            {historical && (
              <label>
                Knowledge cutoff (UTC)
                <input
                  value={cutoff}
                  disabled={busy}
                  placeholder="2026-10-21T12:00:00.000Z"
                  onChange={(event) => setCutoff(event.target.value)}
                />
              </label>
            )}
            <p>
              This reconstructs a source snapshot, bounded by the current
              retained revision. Every record version needs a precise source
              availability timestamp. It does not reproduce individual
              authorization decisions.
            </p>
          </details>
          <p>
            Sandbox copies contain supported purchases only. Edits never change
            retained source records or saved assessments.
          </p>
          <label>
            Import into this dataset
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void perform(() => read(file));
              }}
            />
          </label>
          {upload && (
            <>
              <p>{upload.filename}</p>
              <details>
                <summary>Columns &amp; format</summary>
                <div className="history-columns">
                  <label>
                    Currency when absent from the file
                    <select
                      disabled={busy}
                      value={options.declaredCurrency ?? ""}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          declaredCurrency:
                            event.target.value === "USD" ? "USD" : null,
                        })
                      }
                    >
                      <option value="">Require currency in file</option>
                      <option value="USD">I confirm the amounts are USD</option>
                    </select>
                  </label>
                  <label>
                    Single account ID when absent from the file
                    <input
                      disabled={busy}
                      value={options.declaredSingleAccount ?? ""}
                      maxLength={200}
                      placeholder="Only if every row belongs to this account"
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          declaredSingleAccount:
                            event.target.value.trim() || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={options.declaredPurchases ?? false}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          declaredPurchases: event.target.checked,
                        })
                      }
                    />
                    Missing activity types are purchases
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={options.declaredOutgoing ?? false}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          declaredOutgoing: event.target.checked,
                        })
                      }
                    />
                    Missing directions are outgoing
                  </label>
                  {fields.map((field) => (
                    <label key={field}>
                      {field.replaceAll("_", " ")}
                      <select
                        disabled={busy}
                        value={options.columns?.[field] ?? ""}
                        onChange={(event) => {
                          const columns = { ...options.columns };
                          if (event.target.value)
                            columns[field] = event.target.value;
                          else delete columns[field];
                          updateOptions({ ...options, columns });
                        }}
                      >
                        <option value="">Auto-detect</option>
                        {upload.headers.map((header) => (
                          <option key={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Delimiter
                    <select
                      disabled={busy}
                      value={options.delimiter}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          delimiter: event.target
                            .value as ImportOptions["delimiter"],
                        })
                      }
                    >
                      <option value="auto">Auto-detect</option>
                      <option value=",">Comma</option>
                      <option value=";">Semicolon</option>
                      <option value={"\t"}>Tab</option>
                    </select>
                  </label>
                  <label>
                    Decimal separator
                    <select
                      disabled={busy}
                      value={options.decimalSeparator}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          decimalSeparator: event.target.value as "." | ",",
                        })
                      }
                    >
                      <option value=".">Dot</option>
                      <option value=",">Comma</option>
                    </select>
                  </label>
                  <label>
                    Date order
                    <select
                      disabled={busy}
                      value={options.dateOrder}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          dateOrder: event.target.value as
                            "iso" | "mdy" | "dmy",
                        })
                      }
                    >
                      <option value="iso">ISO (year-month-day)</option>
                      <option value="mdy">Month/day/year</option>
                      <option value="dmy">Day/month/year</option>
                    </select>
                  </label>
                  <label>
                    UTC offset in minutes for times without a timezone
                    <input
                      disabled={busy}
                      type="number"
                      min={-840}
                      max={840}
                      step={1}
                      placeholder="Required for timezone-free times"
                      value={options.utcOffsetMinutes ?? ""}
                      onChange={(event) =>
                        updateOptions({
                          ...options,
                          utcOffsetMinutes:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </details>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    setPreview(
                      await historyApi.preview(dataset.id, {
                        filename: upload.filename,
                        contentBase64: upload.contentBase64,
                        options,
                      }),
                    );
                  })
                }
              >
                Preview retained import
              </button>
            </>
          )}
          {preview && (
            <section aria-label="Retained import preview">
              <h3>Import preview</h3>
              <p>
                {[
                  "added",
                  "duplicate",
                  "conflict",
                  "invalid",
                  ...(preview.rows.some(
                    (row) => row.disposition === "corrected",
                  )
                    ? ["corrected"]
                    : []),
                ]
                  .map(
                    (status) =>
                      `${preview.rows.filter((row) => row.disposition === status).length} ${status}`,
                  )
                  .join(" · ")}
              </p>
              {preview.mapping.user &&
                preview.mapping.card &&
                preview.mapping.card_errors && (
                  <p className="data-notice">
                    Card export: User + Card identifies account history; Year,
                    Month, Day and Time are combined. USD is assumed. Blank
                    Errors? means completed, other values mean failed. The
                    source clock uses {options.utcOffsetMinutes ?? 0} minutes
                    offset from UTC; timestamps without seconds keep :00.
                    Negative amounts remain incoming adjustments, outside
                    purchase scoring.
                  </p>
                )}
              <p>
                {
                  preview.rows.filter(
                    (row) => row.analyticalStatus === "eligible",
                  ).length
                }{" "}
                purchase rows; required inputs are checked when assessed ·{" "}
                {
                  preview.rows.filter(
                    (row) => row.analyticalStatus === "not_assessed",
                  ).length
                }{" "}
                rows retained without assessment
              </p>
              {preview.errors.map((error) => (
                <p role="alert" key={error}>
                  {error}
                </p>
              ))}
              <details>
                <summary>Resolved columns</summary>
                <dl>
                  {Object.entries(preview.mapping).map(([key, header]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{header}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <details>
                <summary>Every source row and its disposition</summary>
                <PaymentPages
                  items={preview.rows}
                  identify={(row) => `${row.row} ${row.sourceEventId ?? ""}`}
                >
                  {(row) => (
                    <p key={row.row}>
                      Row {row.row} · {row.sourceEventId || "ID missing"} ·{" "}
                      {row.disposition} · {row.reason ?? row.analyticalStatus}
                    </p>
                  )}
                </PaymentPages>
              </details>
              <CorrectionReview
                key={preview.id}
                preview={preview}
                busy={busy}
                resolve={(resolution) =>
                  void perform(async () => {
                    setPreview(
                      await historyApi.resolve(
                        dataset.id,
                        preview.id,
                        resolution,
                      ),
                    );
                  })
                }
              />
              <button
                disabled={
                  busy ||
                  !preview.canCommit ||
                  preview.committedRevision !== null
                }
                onClick={() =>
                  void perform(async () => {
                    const committed = await historyApi.commit(
                      dataset.id,
                      preview.id,
                    );
                    setPreview(committed);
                    await refresh(dataset.id);
                    setNotice(
                      "Import committed. Duplicate records were not counted again.",
                    );
                  })
                }
              >
                Commit records
              </button>
            </section>
          )}
          {events && (
            <details>
              <summary>Retained activity ({events.total})</summary>
              <div className="history-actions">
                <button
                  disabled={busy || events.offset === 0}
                  onClick={() =>
                    void perform(async () =>
                      setEvents(
                        await historyApi.events(
                          dataset.id,
                          dataset.revision,
                          Math.max(0, events.offset - 50),
                        ),
                      ),
                    )
                  }
                >
                  Previous records
                </button>
                <span>
                  {events.offset + (events.items.length ? 1 : 0)}–
                  {events.offset + events.items.length} of {events.total}
                </span>
                <button
                  disabled={
                    busy || events.offset + events.items.length >= events.total
                  }
                  onClick={() =>
                    void perform(async () =>
                      setEvents(
                        await historyApi.events(
                          dataset.id,
                          dataset.revision,
                          events.offset + 50,
                        ),
                      ),
                    )
                  }
                >
                  Next records
                </button>
              </div>
              {events.items.map((item) => (
                <details key={item.event.id}>
                  <summary>
                    {item.event.sourceEventId} ·{" "}
                    {item.event.activityType || "unknown activity"} ·{" "}
                    {item.analyticalStatus.replaceAll("_", " ")}
                  </summary>
                  <p>
                    {item.event.accountId} · {item.event.occurredAt} ·{" "}
                    {item.event.amountMinor / 100} {item.event.currency} ·{" "}
                    {item.event.status || "status unknown"}
                  </p>
                  <p>{item.reason}</p>
                  <p>
                    Version recorded {item.recordedAt}; source row{" "}
                    {item.sourceRow}. This is not the original source
                    availability time.
                  </p>
                  <dl>
                    {Object.entries(item.event.sourceFields).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value || "Not supplied"}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <EventVersions
                    key={`${dataset.id}:${item.event.id}:${dataset.revision}`}
                    datasetId={dataset.id}
                    eventId={item.event.id}
                    revision={dataset.revision}
                  />
                </details>
              ))}
            </details>
          )}
          <details>
            <summary>Saved assessments ({runs.length})</summary>
            {runs.map((item) => (
              <p key={item.id}>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async (current) => {
                      const run = await historyApi.run(dataset.id, item.id);
                      if (current()) useAnalysis.setState({ run });
                    })
                  }
                >
                  {item.recordedAt} · revision {item.revision} ·{" "}
                  {item.eventCount} records
                </button>
              </p>
            ))}
          </details>
          {run && <AssessmentResults run={run} />}
        </>
      )}
      {busy && <p role="status">Working…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
