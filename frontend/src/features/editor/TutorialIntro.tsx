import { useEffect, useRef, useState } from "react";
import type { Document } from "../../domain/types";
import { catalog, loadSample } from "../samples/samples";
import { CloseIcon } from "../CloseIcon";

export function TutorialIntro({
  start,
  build,
  close,
}: {
  start: (document: Document) => void;
  build: () => void;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    primary.current?.focus();
    return () => request.current?.abort();
  }, []);
  async function explore() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const sample = catalog.samples.find(
        (sample) => sample.id === "online-episode",
      )!;
      const document = await loadSample(sample, controller.signal);
      controller.signal.throwIfAborted();
      start(document);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to open the sample. Please try again.",
        );
        setLoading(false);
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      className="tutorial-intro"
      aria-labelledby="intro-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <button className="close" aria-label="Close tutorial" onClick={close}>
        <CloseIcon />
      </button>
      <svg className="intro-network" viewBox="0 0 260 90" aria-hidden="true">
        <path d="M25 45 65 20 100 55 145 30 195 55 235 25M65 20 145 30M100 55 195 55M25 45 65 75 100 55M195 55 235 75" />
        {[
          [25, 45],
          [65, 20],
          [65, 75],
          [100, 55],
          [145, 30],
          [195, 55],
          [235, 25],
          [235, 75],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 3 || i === 5 ? 8 : 5} />
        ))}
      </svg>
      <h1 id="intro-title">See the story behind the transactions</h1>
      <p>
        RiskFlow turns transaction data into an interactive map of accounts,
        merchants, and their connections.
      </p>
      <p>
        Explore patterns across the network, find payments worth reviewing, and
        inspect the evidence behind their ranking.
      </p>
      <p>
        Start with a sample or import your own CSV. This tour shows you how to
        move around the graph and investigate what you find.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="inline-actions">
        <button
          ref={primary}
          className="primary"
          disabled={loading}
          onClick={() => void explore()}
        >
          {loading ? "Opening sample…" : "Show me around"}
        </button>
        <button onClick={build}>Build your own graph</button>
      </div>
    </dialog>
  );
}
