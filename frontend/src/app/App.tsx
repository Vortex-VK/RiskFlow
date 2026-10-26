import { CloseIcon } from "../features/CloseIcon";
import { ClearBoardButton } from "../features/ClearBoardButton";
import { PaymentPages } from "../features/PaymentPages";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { components } from "../api/generated";
import { getTemplate, getTemplates } from "../api/client";
import {
  addNode,
  blank,
  clone,
  deletion,
  id,
  newNode,
  assertIntegrity,
  paymentDefault,
} from "../domain/commands";
import { kinds, money, orderedPayments } from "../domain/types";
import type { Document, Entity, Position } from "../domain/types";
import { guarded, useWorkspace } from "../state/workspace";
import { Graph } from "../features/graph/Graph";
import { ObjectTray } from "../features/editor/ObjectTray";
import type { ElasticPose } from "../features/graph/node-motion";
import { pushObjects } from "../features/graph/collisions";
import type { Contact } from "../features/graph/collisions";
import { Inspector } from "../features/editor/Inspector";
import type { Draft } from "../features/editor/draft";
import { useSimulation } from "../state/simulation";
import { projectAnalyticalInput } from "../domain/runs";
import { Replay } from "../features/simulation/Replay";
import { CsvImport } from "../features/import/CsvImport";
import { PolicyForm } from "../features/editor/PolicyForm";
import { ReplaceDialog } from "../features/editor/ReplaceDialog";
import { SampleLibrary } from "../features/samples/SampleLibrary";
import { WorkspaceTutorial } from "../features/editor/WorkspaceTutorial";
import { Presence } from "../features/Presence";

function changed(document: Document, baseline: string) {
  const original = JSON.parse(baseline) as Document;
  return (
    JSON.stringify(document.scenario) !== JSON.stringify(original.scenario) ||
    JSON.stringify(document.view.positions) !==
      JSON.stringify(original.view.positions)
  );
}

function Workspace() {
  const state = useWorkspace();
  const simulation = useSimulation();
  const flow = useReactFlow();
  const [templates, setTemplates] = useState<
    components["schemas"]["TemplateSummary"][]
  >([]);
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState<
    "add" | "payments" | "about" | "import" | null
  >(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editSession, setEditSession] = useState(0);
  const [navigationTarget, setNavigationTarget] =
    useState<HTMLDivElement | null>(null);
  const loadSequence = useRef(0);
  const document = state.document;
  const showObjects = state.visibleGraphIds?.length !== 0;
  const analyticalInput = useMemo(
    () => (document ? projectAnalyticalInput(document.scenario) : ""),
    [document?.scenario],
  );
  const [replacement, setReplacement] = useState<Document | null>(null);
  const [placing, setPlacing] = useState<Entity["type"] | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [newObject, setNewObject] = useState<string | null>(null);
  const [restoreView, setRestoreView] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    try {
      return localStorage.getItem("riskflow:tutorial:v2") !== "seen";
    } catch {
      return true;
    }
  });
  function closeTutorial() {
    setTutorialOpen(false);
    try {
      localStorage.setItem("riskflow:tutorial:v2", "seen");
    } catch {
      /* Optional preference. */
    }
  }
  const [arrival, setArrival] = useState<{
    id: string;
    pose?: ElasticPose;
    contacts?: Contact[];
  } | null>(null);

  useEffect(() => {
    if (state.selection) {
      setPolicyOpen(false);
    }
  }, [state.selection]);

  useEffect(() => {
    if (!showObjects) {
      setPanel((current) => (current === "add" ? null : current));
      setPlacing(null);
      setConnecting(null);
    }
  }, [showObjects]);

  const importedCandidate = useRef<Document | null>(null);
  function install(candidate: Document) {
    setArrival(null);
    setPolicyOpen(false);
    setRestoreView(true);
    state.replace(candidate);
    useWorkspace.setState({
      revealGraph: importedCandidate.current === candidate,
    });
    importedCandidate.current = null;
    loadSequence.current++;
    setReplacement(null);
    setDraft(null);
    setPanel(null);
    setLoadError("");
    setPlacing(null);
    setConnecting(null);
    setNewObject(null);
  }
  function replace(candidate: Document) {
    assertIntegrity(candidate);
    const current = useWorkspace.getState();
    if (
      current.document &&
      (current.dirty || changed(current.document, current.baseline))
    )
      setReplacement(candidate);
    else install(candidate);
  }
  function clearBoard() {
    useSimulation.setState({ playing: false });
    replace(blank());
  }

  async function load(templateId: string) {
    const request = ++loadSequence.current;
    setLoadError("");
    try {
      const [catalog, preset] = await Promise.all([
        getTemplates(),
        getTemplate(templateId),
      ]);
      if (request !== loadSequence.current) return;
      const working = clone(preset);
      working.scenario.id = id();
      setTemplates(catalog);
      replace(working);
    } catch (e) {
      if (request === loadSequence.current)
        setLoadError(
          e instanceof Error ? e.message : "Unable to load the scenario.",
        );
    }
  }
  useEffect(() => {
    try {
      window.localStorage.removeItem("riskflow:v1:scenario");
    } catch {
      state.notify(
        "Browser storage is unavailable. This workspace still runs in memory only.",
      );
    }
    state.replace(blank());
    let cancelled = false;
    void getTemplates().then(
      (catalog) => {
        if (!cancelled) setTemplates(catalog);
      },
      () => {
        if (!cancelled)
          setLoadError(
            "Example scenarios are unavailable. You can still build or import a scenario.",
          );
      },
    );
    return () => {
      cancelled = true;
      loadSequence.current++;
    };
  }, []);
  useEffect(() => {
    window.document.documentElement.dataset.motion = "on";
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const s = useWorkspace.getState();
      if (s.document && (s.dirty || changed(s.document, s.baseline)))
        event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const closeEditor = () => {
    setEditSession((session) => session + 1);
    useWorkspace.setState({ dirty: false, previewContext: null });
    setArrival(null);
    setPolicyOpen(false);
    setPlacing(null);
    setConnecting(null);
    setNewObject(null);
    const selection = useWorkspace.getState().selection;
    setDraft(null);
    useWorkspace.getState().select(null);
    requestAnimationFrame(() => {
      if (useWorkspace.getState().selection) return;
      const selector =
        selection && selection.kind !== "payment"
          ? `.react-flow__${selection.kind === "node" ? "node" : "edge"}[data-id="${CSS.escape(selection.id)}"]`
          : ".top-actions button";
      const target =
        window.document.querySelector<HTMLElement>(selector) ||
        window.document.querySelector<HTMLElement>(".tools button");
      target?.focus({ preventScroll: true });
    });
  };
  const remove = () =>
    guarded(() => {
      const s = useWorkspace.getState();
      if (!s.document || !s.selection) return;
      const result = deletion(s.document, s.selection);
      if (
        s.selection.kind !== "payment" &&
        result.paymentCount &&
        !window.confirm(
          `Delete this ${s.selection.kind === "group" ? "connection" : s.selection.kind} and remove ${result.paymentCount} dependent payment${result.paymentCount === 1 ? "" : "s"} and ${result.relationshipCount} relationship${result.relationshipCount === 1 ? "" : "s"}? You can undo this.`,
        )
      )
        return;
      s.commit(
        result.document,
        `Deleted. Removed ${result.paymentCount} payments and ${result.relationshipCount} relationships. Undo is available.`,
      );
      closeEditor();
    });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (useSimulation.getState().viewing) return;
      if (event.target instanceof Element && event.target.closest("dialog"))
        return;
      if (event.key === "Escape") {
        closeEditor();
        setPanel(null);
        return;
      }
      const typing =
        event.target instanceof Element &&
        !!event.target.closest(
          "input, textarea, select, [contenteditable=true]",
        );
      if (typing) return;
      if (
        event.key.toLowerCase() === "c" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const object =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(".react-flow__node")
            : null;
        if (object?.dataset.id) {
          event.preventDefault();
          connectOnCanvas(object.dataset.id);
          return;
        }
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        if (event.shiftKey || event.key.toLowerCase() === "y") state.redo();
        else state.undo();
      } else if (
        event.key === "Delete" &&
        event.target instanceof Element &&
        event.target.closest(".react-flow__node, .react-flow__edge")
      ) {
        event.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  function add(
    kind: Entity["type"],
    point?: Position,
    pose?: ElasticPose,
    fromTray = false,
  ) {
    guarded(() => {
      if (!document) return;
      if (state.visibleGraphIds?.length === 0) {
        state.notify(
          "Open a group down to interactive detail before adding objects.",
        );
        return;
      }
      const node = newNode(kind, document.scenario.scenarioStartAt);
      const near =
        state.selection?.kind === "node"
          ? document.view.positions[state.selection.id]
          : undefined;
      const center = flow.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const next = addNode(
        document,
        node,
        point || (near ? { x: near.x + 140, y: near.y } : center),
        point ? "exact" : "near",
      );
      const pushed = pushObjects(
        next.scenario.nodes.filter(
          (n) =>
            !state.visibleGraphIds ||
            state.visibleGraphIds.includes(n.id) ||
            n.id === node.id,
        ),
        next.view.positions,
        node.id,
        next.view.positions[node.id]!,
      );
      next.view.positions = pushed.positions;
      state.commit(next, `Added ${kind}. Edit its name and properties.`);
      state.select({ kind: "node", id: node.id });
      setArrival({
        id: node.id,
        ...(pose ? { pose } : {}),
        contacts: pushed.contacts,
      });
      if (!fromTray) setPanel(null);
      setDraft(null);
      setPlacing(null);
      setConnecting(null);
      setNewObject(node.id);
    });
  }
  function connectOnCanvas(source: string) {
    guarded(() => {
      closeEditor();
      setPanel(null);
      setConnecting(source);
      state.notify("Choose a highlighted object to connect. Escape cancels.");
    });
  }
  function chooseTarget(targetId: string, sourceId = connecting) {
    guarded(() => {
      if (!document || !sourceId) return;
      const source = document.scenario.nodes.find((n) => n.id === sourceId);
      const target = document.scenario.nodes.find((n) => n.id === targetId);
      if (!source || !target) return;
      const account =
        source.type === "account"
          ? source
          : target.type === "account"
            ? target
            : null;
      const other = source.type === "account" ? target : source;
      if (!account || other.type === "account") {
        state.notify("Choose an account and a merchant, device, or location.");
        return;
      }
      setConnecting(null);
      closeEditor();
      setPanel(null);
      if (other.type === "merchant")
        create({
          kind: "payment",
          record: paymentDefault(document, account.id, other.id),
        });
      else {
        const existing = document.scenario.associations.find(
          (a) => a.accountId === account.id && a.targetId === other.id,
        );
        if (existing) {
          state.select({ kind: "association", id: existing.id });
          return;
        }
        create({
          kind: "association",
          record: {
            id: id(),
            type: other.type === "device" ? "accountDevice" : "accountLocation",
            accountId: account.id,
            targetId: other.id,
            observedAt: account.openedAt,
            knownFrom: null,
          },
        });
      }
    });
  }
  function create(draft: Draft) {
    setDraft(draft);
    useWorkspace.setState({ dirty: true });
  }
  function openSamples() {
    guarded(() => {
      closeEditor();
      setPanel(null);
      setSamplesOpen(true);
    });
  }

  function simulate() {
    if (useWorkspace.getState().dirty)
      window.document
        .querySelector<HTMLFormElement>("form[data-scenario-form]")
        ?.requestSubmit();
    if (useWorkspace.getState().dirty) return;
    closeEditor();
    setPanel(null);
    void simulation.run();
  }
  if (!document)
    return (
      <main className="loading">
        <span className="brand-mark">rf</span>
        <h1>Opening your workspace…</h1>
      </main>
    );
  const stale =
    simulation.latest && analyticalInput !== simulation.latest.projection;
  const unsupportedPayments = document.scenario.payments.filter(
    (payment) => !payment.modelInput,
  ).length;
  const simulationUnavailable =
    !document.scenario.payments.length || unsupportedPayments > 0;
  return (
    <>
      {replacement && (
        <ReplaceDialog
          cancel={() => setReplacement(null)}
          discard={() => install(replacement)}
        />
      )}
      {samplesOpen && (
        <SampleLibrary
          close={() => setSamplesOpen(false)}
          install={(candidate) => {
            setSamplesOpen(false);
            importedCandidate.current = candidate;
            replace(candidate);
          }}
        />
      )}
      {simulation.viewing && simulation.latest ? (
        <Replay
          key={simulation.latest.result.runId}
          captured={simulation.latest}
          openSamples={openSamples}
        />
      ) : (
        <main className="workspace" aria-label="RiskFlow graph workspace">
          <Graph
            key={state.sessionId}
            navigationTarget={navigationTarget}
            arrival={arrival}
            add={add}
            restoreViewport={restoreView || !!simulation.latest}
            placing={placing}
            connecting={connecting}
            chooseTarget={chooseTarget}
            connectObjects={(source, target) => chooseTarget(target, source)}
          />
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">
                r<span>f</span>
              </span>
              <span>RiskFlow</span>
            </div>
            <div className="import-anchor">
              <button
                className="scenario-toggle"
                aria-expanded={panel === "import"}
                aria-controls="csv-import"
                onClick={() =>
                  guarded(() => {
                    closeEditor();
                    setPanel(panel === "import" ? null : "import");
                  })
                }
              >
                Import CSV{" "}
                <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
              <Presence>
                {panel === "import" && (
                  <CsvImport
                    close={() => setPanel(null)}
                    browseSamples={openSamples}
                    install={(candidate) => {
                      importedCandidate.current = candidate;
                      replace(candidate);
                    }}
                  />
                )}
              </Presence>
            </div>
            <div className="top-actions">
              <button
                className="primary samples-button"
                data-tour="samples"
                onClick={openSamples}
                aria-haspopup="dialog"
              >
                Samples
              </button>
              <button
                aria-expanded={panel === "payments"}
                onClick={() =>
                  setPanel(panel === "payments" ? null : "payments")
                }
              >
                Payments{" "}
                <span className="muted">
                  {document.scenario.payments.length}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="Show tutorial"
                title="Tutorial"
                aria-haspopup="dialog"
                aria-expanded={tutorialOpen}
                onClick={() => {
                  if (tutorialOpen) closeTutorial();
                  else {
                    setTutorialOpen(true);
                  }
                }}
              >
                ?
              </button>
              <button
                className="icon-button"
                aria-label="About this workspace"
                title="Project info"
                aria-expanded={panel === "about"}
                onClick={() => setPanel(panel === "about" ? null : "about")}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6" />
                  <circle
                    cx="12"
                    cy="7.5"
                    r="0.9"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </button>
            </div>
          </header>
          <div className="workspace-controls">
            <div ref={setNavigationTarget} className="group-navigation-slot" />
            <div className="board-actions">
              {showObjects && (
                <button
                  className="objects-toggle"
                  aria-expanded={panel === "add"}
                  aria-controls="object-drawer"
                  onClick={() =>
                    guarded(() => {
                      closeEditor();
                      setPanel(panel === "add" ? null : "add");
                    })
                  }
                >
                  <svg
                    className="chevron"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      d={panel === "add" ? "m10 4-4 4 4 4" : "m6 4 4 4-4 4"}
                    />
                  </svg>{" "}
                  Objects
                </button>
              )}
            </div>
            <Presence>
              {showObjects && panel === "add" && (
                <ObjectTray
                  begin={() => {
                    if (useWorkspace.getState().dirty) {
                      state.notify(
                        "Apply or cancel your unapplied edits before dragging.",
                      );
                      return false;
                    }
                    closeEditor();
                    return true;
                  }}
                  place={(kind, point, pose) => add(kind, point, pose, true)}
                  choose={(kind) =>
                    guarded(() => {
                      closeEditor();
                      setPanel(null);
                      setPlacing(kind);
                    })
                  }
                />
              )}
            </Presence>
          </div>
          <Presence>
            {panel === "about" && (
              <section className="card about">
                <h2>A space to explore risk.</h2>
                <p>
                  Add objects, connect their context, and create payments.
                  Select anything to look closer.
                </p>
                <p>
                  Drag objects to rearrange them. Drag empty canvas to pan. Use
                  Fit to see the network.
                </p>
                <p>
                  Right-drag between an account and another object to connect
                  them. With a keyboard, focus an object and press C, then
                  select the object to connect.
                </p>
                <div className="category-key">
                  {kinds.map((k) => (
                    <span className={`node-${k}`} key={k}>
                      <i />
                      {k}
                    </span>
                  ))}
                </div>
                <hr />
                <p>
                  Arrow keys move a focused object. Ctrl/Cmd+Z undoes a
                  committed edit. Escape cancels dragging. Objects, imported
                  data, and results last for this session. Refreshing starts a
                  new workspace.
                </p>
                <p className="fineprint">
                  Fraud estimates use IBM and authored synthetic transactions.
                  Simulate to inspect model alerts, history support and
                  completed run totals.
                </p>
                <details>
                  <summary>Scenario options</summary>
                  {templates.map((t) => (
                    <button
                      className="menu-item"
                      key={t.id}
                      onClick={() => void load(t.id)}
                    >
                      {t.title}
                      <small>
                        {t.nodeCount} objects · {t.paymentCount} payments
                      </small>
                    </button>
                  ))}
                  <hr />
                  <button
                    className="wide"
                    onClick={() =>
                      guarded(() => {
                        closeEditor();
                        setPanel(null);
                        setPolicyOpen(true);
                      })
                    }
                  >
                    Policy &amp; costs
                  </button>
                  <hr />
                  <button className="wide" onClick={() => replace(blank())}>
                    New blank scenario
                  </button>
                  {document.scenario.sourceTemplateId && (
                    <button
                      className="wide"
                      onClick={() =>
                        void load(document.scenario.sourceTemplateId!)
                      }
                    >
                      Reset to template
                    </button>
                  )}
                </details>
              </section>
            )}
          </Presence>
          {(placing || connecting) && (
            <section className="card placement-bar" aria-label="Canvas action">
              <p>
                {placing
                  ? `Click empty canvas to place a ${placing}.`
                  : "Click a highlighted object to connect."}
              </p>
              <div className="inline-actions">
                {placing && (
                  <button onClick={() => add(placing)}>Place at center</button>
                )}
                <button
                  onClick={() => {
                    setPlacing(null);
                    setConnecting(null);
                  }}
                >
                  Cancel placement
                </button>
              </div>
            </section>
          )}
          <Presence>
            {policyOpen && <PolicyForm key={editSession} close={closeEditor} />}
          </Presence>
          {!policyOpen && panel !== "import" && (
            <Inspector
              editSession={editSession}
              draft={draft}
              close={closeEditor}
              remove={remove}
              create={create}
              nearby={state.selection?.id === newObject}
            />
          )}
          <Presence>
            {panel === "payments" && (
              <section className="card payments-tray" aria-label="Payments">
                <div className="tray-heading">
                  <h2>
                    Payments <span className="muted">· UTC</span>
                  </h2>
                  <button
                    className="close"
                    aria-label="Close payments"
                    onClick={() => setPanel(null)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="event-list">
                  <PaymentPages
                    items={orderedPayments(document.scenario.payments)}
                    identify={(p) => p.id}
                  >
                    {(p) => (
                      <button
                        key={p.id}
                        aria-label={`Payment ${p.id}`}
                        onClick={() =>
                          guarded(() => {
                            setDraft(null);
                            state.select({ kind: "payment", id: p.id });
                            setPanel(null);
                          })
                        }
                      >
                        <span>
                          {p.id.length > 18 ? p.id.slice(0, 8) : p.id}
                        </span>
                        <strong>{money(p.amountMinor)}</strong>
                        <small>{p.occurredAt.slice(11, 23)}</small>
                      </button>
                    )}
                  </PaymentPages>
                </div>
                {!document.scenario.payments.length && (
                  <p>No payments yet. Connect an account to a merchant.</p>
                )}
              </section>
            )}
          </Presence>
          {document.scenario.nodes.length === 0 &&
            !panel &&
            !draft &&
            !placing &&
            !tutorialOpen && (
              <section className="canvas-welcome" aria-label="Get started">
                <h2>Start with an object.</h2>
                <p>
                  Open Objects and drag one onto the canvas, or import a CSV.
                </p>
              </section>
            )}
          <div className="status" role="status" aria-live="polite">
            {simulation.error ||
              loadError ||
              (simulation.pending
                ? "Simulating your scenario…"
                : stale
                  ? "Changes not simulated. Last results remain a run snapshot."
                  : state.message || "Select an object to look closer.")}
          </div>
          <footer className="bottom-bar">
            <div className="draft-label">
              Session only <span>· Illustrative model</span>
            </div>
            <nav className="tools" aria-label="Workspace tools">
              <button
                className="simulate"
                disabled={
                  simulation.pending || (simulationUnavailable && !state.dirty)
                }
                onClick={simulate}
              >
                {simulation.pending ? "Simulating…" : "Simulate"}
              </button>
              {simulation.latest && (
                <button
                  onClick={() =>
                    guarded(() => {
                      closeEditor();
                      useSimulation.setState({ viewing: true, playing: false });
                    })
                  }
                >
                  Last run
                </button>
              )}
              <button
                data-tour="undo"
                disabled={!state.past.length || state.dirty}
                onClick={state.undo}
              >
                Undo
              </button>
              <button
                data-tour="redo"
                disabled={!state.future.length || state.dirty}
                onClick={state.redo}
              >
                Redo
              </button>
              <ClearBoardButton onClick={clearBoard} />
            </nav>
            <div className="tools camera">
              <button aria-label="Zoom out" onClick={() => void flow.zoomOut()}>
                −
              </button>
              <button
                aria-label="Fit network to canvas"
                onClick={() =>
                  void flow.fitView({ padding: 0.25, duration: 0 })
                }
              >
                Fit
              </button>
              <button aria-label="Zoom in" onClick={() => void flow.zoomIn()}>
                +
              </button>
            </div>
          </footer>
        </main>
      )}
      {tutorialOpen && (
        <WorkspaceTutorial
          close={closeTutorial}
          showObjects={showObjects}
          panel={panel}
          draft={draft}
          samplesOpen={samplesOpen}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
