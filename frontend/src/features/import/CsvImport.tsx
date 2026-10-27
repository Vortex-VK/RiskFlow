import { prepareSimulation } from "../../api/prepareSimulation";
import { CloseIcon } from "../CloseIcon";
import { useEffect, useRef, useState } from "react";
import {
  buildCsvDocument,
  csvFields,
  initialMapping,
  isCardMapping,
  parseCsv,
} from "../../domain/csv";
import type { ColumnMapping, CsvTable, ImportDefaults } from "../../domain/csv";
import type { Document } from "../../domain/types";
import { money } from "../../domain/types";
import sampleCsvUrl from "../../assets/sample-payments.csv?url";
import { decodeCsvBytes } from "../../domain/csv-values";
import { MAX_CSV_BYTES } from "../../domain/limits";
import { csvDefaults } from "../../domain/csv-defaults";

export function CsvImport({
  close,
  install,
  browseSamples,
}: {
  close: () => void;
  install: (document: Document) => void;
  browseSamples: () => void;
}) {
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    initialMapping([]),
  );
  const [defaults, setDefaults] = useState<ImportDefaults>(() => csvDefaults());
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Document | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [purpose, setPurpose] = useState<"graph" | "model">("model");
  const generation = useRef(0);
  const previewElement = useRef<HTMLElement>(null);
  useEffect(() => {
    previewElement.current?.scrollIntoView({ block: "start" });
  }, [preview]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const invalidate = () => {
    setPreview(null);
    setErrors([]);
    setWarnings([]);
  };
  const columns = (fields: readonly (typeof csvFields)[number][]) =>
    fields.map((field) => (
      <label key={field}>
        {field.replaceAll("_", " ")}
        <select
          aria-label={`Column for ${field}`}
          value={mapping[field]}
          onChange={(e) => {
            invalidate();
            setMapping({ ...mapping, [field]: e.target.value });
          }}
        >
          <option value="">
            {field === "timestamp" || field === "amount"
              ? "Choose column"
              : "Not supplied"}
          </option>
          {table!.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
    ));
  return (
    <aside
      id="csv-import"
      className="card import-inspector"
      aria-label="CSV import"
    >
      <button className="close" aria-label="Close CSV import" onClick={close}>
        <CloseIcon />
      </button>
      <div className="kicker">Build from data</div>
      <h2>Import payments</h2>
      <p>
        Drop a transaction export, map its columns, then preview your graph. Up
        to 10,000 rows, 1,000 objects, and 5 MB. USD only. This session only.
      </p>
      <p>
        Graph investigation works independently of model scoring. Choose Graph
        only to explore a file without the inputs required for simulation.
      </p>
      <label>
        Import purpose
        <select
          value={purpose}
          onChange={(event) => {
            invalidate();
            setPurpose(event.target.value as "graph" | "model");
          }}
        >
          <option value="model">Graph and simulation</option>
          <option value="graph">
            Graph only · no simulation for incomplete data
          </option>
        </select>
      </label>
      {purpose === "model" && (
        <p>
          Score payments using transaction behavior, account history and
          merchant context. Compatible fields are required; review alerts
          alongside your source data.
        </p>
      )}
      <p>
        <a href={sampleCsvUrl} download="sample-payments.csv">
          Download example CSV
        </a>
      </p>
      <button className="wide" onClick={browseSamples}>
        Browse IBM samples · 5 to 10,000 transactions
      </button>
      <label className="file-picker">
        <strong>
          {fileName ? "Choose another CSV" : "Choose a CSV or drop it here"}
        </strong>
        <span>{fileName || "Comma, semicolon, or tab separated"}</span>
        <input
          aria-label="CSV file"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const token = ++generation.current;
            invalidate();
            setTable(null);
            setFileName(file?.name || "");
            if (!file) {
              setReading(false);
              return;
            }
            setReading(true);
            try {
              if (file.size > MAX_CSV_BYTES)
                throw new Error("CSV must be at most 5 MB.");
              const content = decodeCsvBytes(await file.arrayBuffer());
              if (token !== generation.current) return;
              const parsed = parseCsv(content);
              setTable(parsed);
              const mapped = initialMapping(parsed.headers);
              setMapping(mapped);
              setDefaults((old) => ({
                ...old,
                amountMode: mapped.debit ? "debit-credit" : "positive",
                timezone: /_utc$/i.test(mapped.timestamp) ? "Z" : "",
                name:
                  file.name.replace(/\.csv$/i, "").slice(0, 80) ||
                  "Imported scenario",
              }));
            } catch (error) {
              if (token === generation.current)
                setErrors([
                  error instanceof Error
                    ? error.message
                    : "Unable to read CSV.",
                ]);
            } finally {
              if (token === generation.current) setReading(false);
            }
          }}
        />
      </label>
      {reading && <p>Reading CSV…</p>}
      {table && (
        <>
          <p>
            {table.rows.length} rows · {table.headers.length} columns
          </p>
          {isCardMapping(mapping) && (
            <p className="data-notice">
              Card export detected: Year, Month, Day and Time are combined; User
              + Card identifies each account history. Blank Errors? means
              completed, otherwise failed. The source has no timezone: UTC is
              assumed unless you set an offset under Columns &amp; format.
            </p>
          )}
          <label>
            Scenario name
            <input
              value={defaults.name}
              maxLength={80}
              onChange={(e) => {
                invalidate();
                setDefaults({ ...defaults, name: e.target.value });
              }}
            />
          </label>
          <details>
            <summary>Columns &amp; format</summary>
            {columns([
              "timestamp",
              "year",
              "month",
              "day",
              "time",
              "amount",
              "debit",
              "credit",
              "merchant_name",
              "currency",
            ])}
            <label>
              Amount direction
              <select
                aria-label="Amount direction"
                value={defaults.amountMode}
                onChange={(e) => {
                  invalidate();
                  setDefaults({
                    ...defaults,
                    amountMode: e.target.value as NonNullable<
                      ImportDefaults["amountMode"]
                    >,
                  });
                }}
              >
                <option value="positive">Positive purchases only</option>
                <option value="negative">
                  Money out is negative · exclude money in
                </option>
                <option value="debit-credit">
                  Separate debit / credit · import debits
                </option>
              </select>
            </label>
            <label>
              Date format
              <select
                aria-label="Date format"
                value={defaults.dateOrder}
                onChange={(e) => {
                  invalidate();
                  setDefaults({
                    ...defaults,
                    dateOrder: e.target.value as NonNullable<
                      ImportDefaults["dateOrder"]
                    >,
                  });
                }}
              >
                <option value="iso">Year-month-day / ISO</option>
                <option value="mdy">Month/day/year</option>
                <option value="dmy">Day/month/year</option>
              </select>
            </label>
            <label>
              Decimal format
              <select
                aria-label="Decimal format"
                value={defaults.decimal}
                onChange={(e) => {
                  invalidate();
                  setDefaults({
                    ...defaults,
                    decimal: e.target.value as "dot" | "comma",
                  });
                }}
              >
                <option value="dot">1,234.56</option>
                <option value="comma">1.234,56</option>
              </select>
            </label>
            <label>
              UTC offset for times without a timezone
              <input
                placeholder="Z or -04:00"
                value={defaults.timezone}
                onChange={(e) => {
                  invalidate();
                  setDefaults({ ...defaults, timezone: e.target.value.trim() });
                }}
              />
            </label>
            <p>
              Map a timestamp/date column or Year, Month and Day, plus Time.
              Date-only files cannot be imported for simulation. Card exports
              exclude negative amounts as incoming adjustments; other
              positive-purchase files require refunds to be removed first.
            </p>
          </details>
          <details>
            <summary>Identity &amp; context columns</summary>
            <p>
              Reuse a source ID to share an object; names are display labels.
              Use consistent metadata for shared objects. Multiple usual
              countries/categories use | separators.
            </p>
            {columns(
              csvFields.filter(
                (f) =>
                  ![
                    "timestamp",
                    "year",
                    "month",
                    "day",
                    "time",
                    "amount",
                    "debit",
                    "credit",
                    "merchant_name",
                    "currency",
                  ].includes(f),
              ),
            )}
            <p>
              When transaction type is mapped, only charge, payment, purchase,
              and bill_payment rows are included. The preview reports excluded
              rows.
            </p>
          </details>
          <details>
            <summary>Assumptions for missing metadata</summary>
            <p>
              These are editable modeling assumptions, not inferred facts.
              Optional CSV values override them. Missing context creates clearly
              named unknown objects, separately for each account.
            </p>
            <label>
              Account name for a single-account statement
              <input
                value={defaults.statementAccount}
                maxLength={80}
                onChange={(e) => {
                  invalidate();
                  setDefaults({
                    ...defaults,
                    statementAccount: e.target.value,
                  });
                }}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={defaults.useAssumedBaselines}
                onChange={(e) => {
                  invalidate();
                  setDefaults({
                    ...defaults,
                    useAssumedBaselines: e.target.checked,
                  });
                }}
              />
              Apply the display assumptions below
            </label>
            <p>
              These legacy account baselines and broad categories describe the
              graph. They do not change predictions or replace missing MCCs and
              channels.
            </p>
            {(
              [
                ["openedAt", "Account opened · ISO timestamp"],
                ["typicalAmount", "Typical purchase · USD"],
                ["countries", "Usual countries · separated by |"],
                ["categories", "Usual categories · separated by |"],
                ["merchantCategory", "Merchant category"],
                ["merchantCountry", "Merchant country · ISO code"],
                ["locationCountry", "Location country · ISO code"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={defaults[key]}
                  onChange={(e) => {
                    invalidate();
                    setDefaults({ ...defaults, [key]: e.target.value });
                  }}
                />
              </label>
            ))}
            <p>
              Missing observations use the first payment for each
              account–device/location pair. Missing familiarity stays unknown;
              missing labels stay unlabeled. Simulation uses exact MCC,
              transaction channel, completion status and purchase history.
              Device familiarity is not a predictor.
            </p>
            <p>
              Simulation uses fixed alert thresholds and sends alerts to review,
              with no automatic blocking. Illustrative cost assumptions can be
              edited in Policy &amp; costs.
            </p>
          </details>
          <button
            className="wide"
            disabled={reading}
            onClick={() => {
              const result = buildCsvDocument(table, mapping, defaults, {
                width: window.innerWidth,
                height: window.innerHeight,
              });
              const payments = result.document?.scenario.payments ?? [];
              const unsupported = payments.filter(
                (payment) => !payment.modelInput,
              );
              if (purpose === "model" && unsupported.length) {
                setErrors([
                  `Cannot import for simulation: ${unsupported.length} of ${payments.length} payments have missing or unsupported simulation inputs.`,
                  "Map precise timestamps, four-digit MCCs, transaction channels (Chip Transaction, Online Transaction or Swipe Transaction), and completion status (completed, failed or declined). To explore this file without scoring, choose Graph only above.",
                ]);
                setWarnings([]);
                setPreview(null);
                return;
              }
              setErrors(result.errors);
              setWarnings(result.warnings);
              setPreview(result.document);
              if (purpose === "model" && result.document)
                void prepareSimulation(result.document)?.catch(() => {});
            }}
          >
            Preview graph
          </button>
        </>
      )}
      {!!errors.length && (
        <div role="alert">
          <h3>Fix these before importing</h3>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {preview && (
        <section ref={previewElement} aria-label="Import preview">
          <h3>Ready to build</h3>
          {!!warnings.length && (
            <div className="data-notice">
              <h4>Data notes</h4>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <p>
            {preview.scenario.nodes.length} objects ·{" "}
            {preview.scenario.associations.length} relationships ·{" "}
            {preview.scenario.payments.length} payments
          </p>
          <p>
            {Object.keys(preview.scenario.groundTruth).length} labeled ·{" "}
            {preview.scenario.payments.length -
              Object.keys(preview.scenario.groundTruth).length}{" "}
            unlabeled
          </p>
          <p>
            Larger imports open as transaction groups; select groups to reach
            interactive detail. Reused source IDs become shared objects. This
            replaces the open scenario.
          </p>
          {purpose === "graph" && (
            <p>
              This import builds an investigation graph without running a fraud
              model. Display placeholders do not establish shared real devices
              or locations. Model simulation remains a separate action.
            </p>
          )}
          <details>
            <summary>Objects in the imported graph</summary>
            <ul>
              {preview.scenario.nodes.map((node) => (
                <li key={node.id}>
                  {node.type}: {node.name}
                </li>
              ))}
            </ul>
          </details>
          <div className="import-table">
            <table>
              <caption>First five payments</caption>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>UTC</th>
                </tr>
              </thead>
              <tbody>
                {preview.scenario.payments.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{money(p.amountMinor)}</td>
                    <td>{p.occurredAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="primary wide" onClick={() => install(preview)}>
            Build graph
          </button>
        </section>
      )}
    </aside>
  );
}
