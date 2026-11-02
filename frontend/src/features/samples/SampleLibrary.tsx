import { CloseIcon } from "../CloseIcon";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Document } from "../../domain/types";
import { catalog, loadSample, sampleUrl } from "./samples";
import "./samples.css";
import { panelDuration } from "../Presence";
import { ModelValidation } from "./ModelValidation";

const number = (value: number) => value.toLocaleString("en-US");

export function SampleLibrary({
  close,
  install,
  options,
}: {
  options?: ReactNode;
  close: () => void;
  install: (document: Document) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState(catalog.defaultSampleId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const closingAction = useRef<(() => void) | null>(null);
  const sample = catalog.samples.find((entry) => entry.id === selected)!;
  const flaggedPercent = (sample.alertCount / sample.rows) * 100;
  const percentage = `${Number(flaggedPercent.toFixed(2))}%`;

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      controller.current?.abort();
      element.close();
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      dialog.current?.close();
      closingAction.current?.();
    }, panelDuration());
    return () => clearTimeout(timer);
  }, [closing]);

  function finish(action: () => void) {
    if (closingAction.current) return;
    closingAction.current = action;
    setClosing(true);
  }

  function dismiss() {
    controller.current?.abort();
    finish(close);
  }

  async function open() {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setLoading(true);
    setError("");
    try {
      const document = await loadSample(sample, request.signal);
      if (request.signal.aborted) return;
      finish(() => install(document));
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to open this sample.",
        );
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="sample-library"
      data-closing={closing}
      inert={closing}
      aria-labelledby="sample-library-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <header className="sample-header">
        <div>
          <h1 id="sample-library-title">Start with a sample.</h1>
          <p>Choose a graph to explore, then run a simulation.</p>
        </div>
        <button
          className="sample-close"
          aria-label="Close sample library"
          onClick={dismiss}
          autoFocus
        >
          <CloseIcon />
        </button>
      </header>
      <div className="sample-layout">
        <nav className="sample-list" aria-label="Choose a sample">
          {catalog.samples.map((entry, index) => (
            <button
              key={entry.id}
              className="sample-option"
              aria-pressed={entry.id === selected}
              aria-controls="sample-detail"
              disabled={loading}
              onClick={() => {
                setSelected(entry.id);
                setError("");
              }}
            >
              <span className="sample-index" aria-hidden="true">
                0{index + 1}
              </span>
              <span className="sample-option-copy">
                <strong>{entry.title}</strong>
                <span>{number(entry.rows)} transactions</span>
              </span>
            </button>
          ))}
        </nav>
        <section
          id="sample-detail"
          className="sample-detail"
          aria-label={sample.title}
          key={sample.id}
        >
          <h2>{sample.title}</h2>
          <p className="sample-description">{sample.description}</p>
          <dl className="sample-facts">
            <div>
              <dt>Transactions</dt>
              <dd>{number(sample.rows)}</dd>
            </div>
            <div>
              <dt>Accounts</dt>
              <dd>{number(sample.accounts)}</dd>
            </div>
            <div>
              <dt>Merchants</dt>
              <dd>{number(sample.merchants)}</dd>
            </div>
          </dl>
          <section className="sample-outcomes" aria-label="Sample results">
            <h3>Default review results</h3>
            <p>
              Current automatic review capacity. Curated examples, not an
              independent accuracy benchmark.
            </p>
            <div className="sample-detection-heading">
              <span>Selected for review</span>
              <strong>{percentage}</strong>
            </div>
            <div
              className="sample-detection-bar"
              role="meter"
              aria-label="Transactions selected for review"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={flaggedPercent}
              aria-valuetext={`${percentage} — ${number(sample.alertCount)} of ${number(sample.rows)} transactions`}
            >
              <span style={{ width: `${flaggedPercent}%` }} />
            </div>
            <p className="sample-detection-count">
              {number(sample.alertCount)} of {number(sample.rows)} transactions
            </p>
            <dl>
              <div>
                <dt>Fraud caught</dt>
                <dd>
                  {sample.metrics.truePositive} / {sample.fraudCount}
                </dd>
              </div>
              <div>
                <dt>False alerts</dt>
                <dd>{sample.metrics.falsePositive}</dd>
              </div>
            </dl>
          </section>
          <div className="sample-actions">
            <button
              className="primary"
              onClick={() => void open()}
              disabled={loading}
            >
              {loading ? "Preparing sample…" : "Open in workspace"}
            </button>
            <a
              className="sample-download"
              href={sampleUrl(sample.file)}
              download={`riskflow-${sample.id}.csv`}
            >
              Download CSV <span aria-hidden="true">↓</span>
            </a>
          </div>
          {error && (
            <p className="sample-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      {options}
      <ModelValidation />
      <footer className="sample-footer">
        <span>Curated synthetic examples</span>
        <div>
          <a href={sample.sourceUrl} target="_blank" rel="noreferrer">
            {sample.sourceName}
          </a>
          {" · "}
          <a
            href={sampleUrl(sample.attributionFile)}
            target="_blank"
            rel="noreferrer"
          >
            Attribution
          </a>
          {" · "}
          <a href={sample.licenseUrl} target="_blank" rel="noreferrer">
            License
          </a>
        </div>
      </footer>
    </dialog>
  );
}
