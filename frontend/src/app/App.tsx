import { unsupportedRankingInput } from "../domain/model";
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
import { money, orderedPayments } from "../domain/types";
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
import { TutorialIntro } from "../features/editor/TutorialIntro";
import { GraphTutorial } from "../features/editor/GraphTutorial";
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
  const [panel, setPanel] = useState<"add" | "payments" | "import" | null>(
    null,
  );
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
  const [tutorialMode, setTutorialMode] = useState<"intro" | "graph" | "build">(
    "intro",
  );
  const tutorialCandidate = useRef<{
    document: Document;
    mode: "graph" | "build";
  } | null>(null);
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
  function buildTutorial() {
    startTutorial(blank(), "build");
  }
  function startGraphTutorial(candidate: Document) {
    startTutorial(candidate, "graph");
  }
  function startTutorial(candidate: Document, mode: "graph" | "build") {
    tutorialCandidate.current = { document: candidate, mode };
    const current = useWorkspace.getState();
    if (
      current.dirty ||
      current.document?.scenario.nodes.length ||
      current.document?.scenario.payments.length
    ) {
      setTutorialOpen(false);
      setReplacement(candidate);
    } else install(candidate);
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
    const tutorial =
      tutorialCandidate.current?.document === candidate
        ? tutorialCandidate.current
        : null;
    setArrival(null);
    setPolicyOpen(false);
    setRestoreView(true);
    state.replace(candidate);
    useWorkspace.setState({
      revealGraph:
        importedCandidate.current === candidate || tutorial?.mode === "graph",
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
    if (tutorial) {
      tutorialCandidate.current = null;
      setSamplesOpen(false);
      setTutorialMode(tutorial.mode);
      setTutorialOpen(true);
    }
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
      if (!fromTray || tutorialOpen) setPanel(null);
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
    const workspace = useWorkspace.getState();
    if (workspace.revealGraph || !workspace.document?.scenario.payments.length)
      return;
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
    unsupportedRankingInput,
  ).length;
  const simulationUnavailable =
    !document.scenario.payments.length || unsupportedPayments > 0;
  const simulationBarReady =
    document.scenario.payments.length > 0 && !state.revealGraph;
  return (
    <>
      {replacement && (
        <ReplaceDialog
          cancel={() => {
            setReplacement(null);
            if (tutorialCandidate.current) {
              tutorialCandidate.current = null;
              setTutorialMode("intro");
              setTutorialOpen(true);
            }
          }}
          discard={() => install(replacement)}
        />
      )}
      {samplesOpen && (
        <SampleLibrary
          options={
            <details className="scenario-options">
              <summary>Scenario options</summary>
              {templates.map((t) => (
                <button
                  className="menu-item"
                  key={t.id}
                  onClick={() => {
                    setSamplesOpen(false);
                    void load(t.id);
                  }}
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
                    setSamplesOpen(false);
                    setPolicyOpen(true);
                  })
                }
              >
                Policy &amp; costs
              </button>
              <hr />
              <button
                className="wide"
                onClick={() => {
                  setSamplesOpen(false);
                  replace(blank());
                }}
              >
                New blank scenario
              </button>
              {document.scenario.sourceTemplateId && (
                <button
                  className="wide"
                  onClick={() => {
                    setSamplesOpen(false);
                    void load(document.scenario.sourceTemplateId!);
                  }}
                >
                  Reset to template
                </button>
              )}
            </details>
          }
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
          openTutorial={() => {
            setTutorialMode("intro");
            setTutorialOpen(true);
          }}
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
                    setTutorialMode("intro");
                    setTutorialOpen(true);
                  }
                }}
              >
                ?
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
          {(simulation.error || loadError) && (
            <div className="workspace-error card" role="alert">
              {simulation.error || loadError}
            </div>
          )}
          <div className="status" role="status" aria-live="polite">
            {simulation.error ||
              loadError ||
              (simulation.pending
                ? "Simulating your scenario…"
                : stale
                  ? "Changes not simulated. Last results remain a run snapshot."
                  : state.message)}
          </div>
          <Presence>
            {simulationBarReady && (
              <footer className="bottom-bar workspace-bar">
                <nav className="tools" aria-label="Workspace tools">
                  <button
                    className="simulate"
                    disabled={
                      simulation.pending ||
                      (simulationUnavailable && !state.dirty)
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
                          useSimulation.setState({
                            viewing: true,
                            playing: false,
                          });
                        })
                      }
                    >
                      Last run
                    </button>
                  )}
                  <ClearBoardButton onClick={clearBoard} />
                </nav>
              </footer>
            )}
          </Presence>
        </main>
      )}
      {tutorialOpen && tutorialMode === "intro" && (
        <TutorialIntro
          start={startGraphTutorial}
          build={buildTutorial}
          close={closeTutorial}
        />
      )}
      {tutorialOpen && tutorialMode === "graph" && (
        <GraphTutorial
          close={closeTutorial}
          samples={() => {
            closeTutorial();
            openSamples();
          }}
          importCsv={() => {
            closeTutorial();
            useSimulation.setState({ viewing: false, playing: false });
            setPanel("import");
          }}
        />
      )}
      {tutorialOpen && tutorialMode === "build" && (
        <WorkspaceTutorial
          addObject={add}
          connectObjects={(account, merchant) =>
            chooseTarget(merchant, account)
          }
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
