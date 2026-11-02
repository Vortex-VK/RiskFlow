import { useEffect, useState } from "react";
import { useWorkspace } from "../../state/workspace";
import { useSimulation } from "../../state/simulation";
import { TutorialSpotlight } from "./TutorialSpotlight";
import { clickTutorialTarget as click } from "./tutorialActions";

type Phase =
  | "overview"
  | "connections"
  | "details"
  | "return"
  | "simulate"
  | "evidence"
  | "complete"
  | "results";
const graph = ".graph-stage";
const trail = ".hierarchy-navigation";
const connection = ".connection-target";
const connectionPanel = ".connection-details";
const reviewButton = ".review-total";
const payment = '[aria-label="Run events"] .payment-result';
const evidence = ".payment-explanation";
const resultsButton = '[data-tour="results"]';
const resultsPanel = '[data-tour="results-panel"]';

function readGraph() {
  const stage = document.querySelector<HTMLElement>(".hierarchy-stage");
  const visible = (selector: string) => {
    const element = document.querySelector(selector);
    return !!element && !element.closest('[inert], [aria-hidden="true"]');
  };
  return {
    depth: Number(stage?.dataset.tourDepth ?? 0),
    detail: stage?.dataset.detail === "true",
    transitioning: stage?.dataset.transitioning === "true",
    connection: visible(connectionPanel),
    payments: visible(payment),
    evidence: visible(evidence),
    results: visible(resultsPanel),
    completed: !!document.querySelector('[data-playback-complete="true"]'),
  };
}

export function GraphTutorial({
  close,
  samples,
  importCsv,
}: {
  close: () => void;
  samples: () => void;
  importCsv: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("overview");
  const [view, setView] = useState(readGraph);
  const [rootSeen, setRootSeen] = useState(false);
  const revealing = useWorkspace((s) => s.revealGraph);
  const simulation = useSimulation();
  useEffect(() => {
    const update = () => {
      const next = readGraph();
      setView((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-tour-depth",
        "data-detail",
        "data-transitioning",
        "aria-hidden",
        "data-playback-complete",
      ],
    });
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (view.transitioning) return;
    if (phase === "overview" && !revealing) {
      if (view.depth === 0) setRootSeen(true);
      else if (rootSeen) setPhase("connections");
    }
    if (phase === "details" && view.detail) setPhase("return");
    if (phase === "return" && view.depth === 0) setPhase("simulate");
    if (
      phase === "simulate" &&
      simulation.viewing &&
      view.completed &&
      !simulation.playing
    )
      setPhase("evidence");
    if (phase === "evidence" && view.evidence) setPhase("complete");
  }, [
    phase,
    view,
    rootSeen,
    revealing,
    simulation.viewing,
    simulation.playing,
  ]);

  function next() {
    if (phase === "overview")
      click('.transaction-sector[data-leaf="false"] .sector-label');
    if (phase === "connections") {
      if (!view.connection) click(connection);
      else {
        click('[aria-label="Close connection evidence"]');
        setPhase("details");
      }
    }
    if (phase === "details") click(".sector-label");
    if (phase === "return") {
      click('[aria-label="Close details"]');
      click(`${trail} button`);
    }
    if (phase === "simulate") {
      if (!simulation.viewing) click(".tools .simulate");
      else if (view.completed) setPhase("evidence");
      else click(".playback button:nth-child(2)");
    }
    if (phase === "evidence") click(view.payments ? payment : reviewButton);
    if (phase === "complete") {
      click(resultsButton);
      setPhase("results");
    }
    if (phase === "results" && !view.results) click(resultsButton);
  }
  function back() {
    if (phase === "connections") {
      click('[aria-label="Close connection evidence"]');
      click(`${trail} button`);
      setRootSeen(false);
      setPhase("overview");
    } else if (phase === "details" || phase === "return") {
      click('[aria-label="Close details"]');
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        `${trail} button`,
      );
      if (view.detail && buttons.length > 1)
        click(`${trail} button:nth-child(${buttons.length - 1})`);
      setPhase("connections");
    } else if (phase === "simulate") {
      useSimulation.setState({ viewing: false, playing: false });
      setPhase("details");
    } else if (phase === "evidence") {
      click('[aria-label="Close events"]');
      click(".playback button:nth-child(2)");
      setPhase("simulate");
    } else if (phase === "complete") {
      click('[aria-label="Close explanation"]');
      click(reviewButton);
      setPhase("evidence");
    }
  }
  const watching =
    phase === "simulate" && simulation.viewing && !view.completed;
  const action = {
    overview: {
      title: revealing
        ? "Watch the network take shape"
        : "Start with the big picture",
      text: revealing
        ? "Accounts and merchants connect as the sample graph appears."
        : "Each group brings together related payments. Drag empty space to pan. Click a group, zoom toward it, or choose Next to explore inside.",
      selectors: revealing
        ? []
        : ['.transaction-sector[data-leaf="false"] .sector-label', trail],
    },
    connections: {
      title: view.connection
        ? "See what connects the groups"
        : "Follow a shared connection",
      text: view.connection
        ? "The shared object is named at the top. Below it are the connected accounts and related payments. A shared connection is context, not proof of fraud. Choose Next to continue."
        : "The glowing path links groups that share an object. Select it, or choose Next, to see what connects them.",
      selectors: view.connection ? [connectionPanel] : [],
    },
    details: {
      title: "Explore inside a group",
      text: "Open a smaller group to see individual accounts, merchants, and their connections. Next opens one for you.",
      selectors: [".sector-label", trail],
    },
    return: {
      title: "Find your way back",
      text: "You are now viewing individual objects and their links. Choose All payments in the navigation trail, or Next, to return to the full network. Zooming out also moves back through groups.",
      selectors: [`${trail} button:first-child`],
    },
    simulate: {
      title: watching
        ? "Watch the payments flow"
        : view.completed
          ? "Your review is ready"
          : "Run the simulation",
      text: simulation.error
        ? `The simulation did not finish: ${simulation.error} Choose Next to retry.`
        : simulation.pending
          ? "The model is preparing the payment rankings."
          : watching
            ? "Payments light up as they are assessed. When playback finishes, the tour moves to the review list."
            : view.completed
              ? "The simulation is complete. Continue to inspect the payments that need review."
              : "Choose Simulate, or Next, to watch payments move through the network and receive their review rankings.",
      selectors: simulation.viewing ? [] : [".tools .simulate"],
    },
    evidence: {
      title: view.payments
        ? "Choose a payment to investigate"
        : "Open the review list",
      text: view.payments
        ? "This list contains the payments selected for review. Select the highlighted payment, or Next, to see why it ranked highly."
        : "Select the underlined need review count, or Next, to open the prioritized payments. Review capacity sets how many are selected.",
      selectors: view.payments ? [payment] : [reviewButton],
    },
    complete: {
      title: "Follow the evidence",
      text: "The priority breakdown explains this payment’s ranking. Use it alongside the graph’s connections to investigate. Choose Next to see the results for the whole run.",
      selectors: [evidence],
    },
    results: {
      title: "See the whole run",
      text: view.results
        ? "Results summarizes the review workload and patterns across the network. You can return here after investigating individual payments. Try another sample or import your own transactions to explore further."
        : "Open Results to see the review workload and patterns across the whole run.",
      selectors: view.results ? [resultsPanel] : [resultsButton],
    },
  }[phase];
  const step = {
    overview: 0,
    connections: 1,
    details: 2,
    return: 2,
    simulate: 3,
    evidence: 4,
    complete: 4,
    results: 5,
  }[phase];
  const allowed = revealing
    ? []
    : phase === "connections"
      ? view.connection
        ? [connectionPanel]
        : [connection, trail]
      : phase === "overview" || phase === "details" || phase === "return"
        ? [graph, trail]
        : phase === "simulate"
          ? [
              ".tools .simulate",
              ".playback button:nth-child(2)",
              ".playback-speed",
            ]
          : phase === "evidence"
            ? [reviewButton, '[aria-label="Run events"]']
            : phase === "results"
              ? [resultsButton, resultsPanel]
              : [evidence];
  return (
    <TutorialSpotlight
      phase={phase}
      title={action.title}
      text={action.text}
      selectors={action.selectors}
      allowed={allowed}
      pathSelector={
        phase === "connections" && !view.connection ? connection : undefined
      }
      readOnly={
        phase === "connections" && view.connection
          ? [".connection-payment", '[aria-label="Close connection evidence"]']
          : []
      }
      dim={!revealing && !(phase === "simulate" && simulation.viewing)}
      avoid={phase === "simulate" && simulation.viewing ? [".playback"] : []}
      freeCanvas
      label={`Explore the graph · ${step + 1} of 6`}
      step={step}
      steps={6}
      close={close}
    >
      <div
        className={`inline-actions${phase === "results" && view.results ? " tour-finish-actions" : ""}`}
      >
        {phase === "results" && view.results ? (
          <>
            <button className="primary" onClick={samples}>
              Explore the samples
            </button>
            <button onClick={importCsv}>Import your CSV</button>
          </>
        ) : (
          <>
            {phase !== "overview" && phase !== "results" && (
              <button
                onClick={back}
                disabled={
                  view.transitioning ||
                  simulation.pending ||
                  (watching && simulation.playing)
                }
              >
                Back
              </button>
            )}
            <button
              className="primary"
              onClick={next}
              disabled={
                revealing ||
                view.transitioning ||
                simulation.pending ||
                (watching && simulation.playing)
              }
            >
              Next
            </button>
            {phase === "overview" && <button onClick={close}>Skip tour</button>}
          </>
        )}
      </div>
    </TutorialSpotlight>
  );
}
