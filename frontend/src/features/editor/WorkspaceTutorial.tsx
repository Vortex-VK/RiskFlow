import { useEffect, useRef, useState } from "react";
import { panelDuration } from "../Presence";
import { useWorkspace } from "../../state/workspace";
import { useSimulation } from "../../state/simulation";
import type { Draft } from "./draft";
import { TutorialSpotlight } from "./TutorialSpotlight";
import {
  clickTutorialTarget as click,
  submitTutorialForm,
} from "./tutorialActions";

type Phase =
  | "prepare"
  | "group"
  | "objects"
  | "account"
  | "edit"
  | "merchant"
  | "connect"
  | "payment"
  | "simulate"
  | "results"
  | "samples";
const sequence: Phase[] = [
  "objects",
  "account",
  "edit",
  "merchant",
  "connect",
  "payment",
  "simulate",
  "results",
  "samples",
];
export function WorkspaceTutorial({
  close,
  showObjects,
  panel,
  draft,
  samplesOpen,
  addObject,
  connectObjects,
}: {
  close: () => void;
  showObjects: boolean;
  panel: string | null;
  draft: Draft | null;
  samplesOpen: boolean;
  addObject: (kind: "account" | "merchant") => void;
  connectObjects: (account: string, merchant: string) => void;
}) {
  const workspace = useWorkspace();
  const simulation = useSimulation();
  const [phase, setPhase] = useState<Phase>(() =>
    workspace.dirty ? "prepare" : showObjects ? "objects" : "group",
  );
  const [closing, setClosing] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [setupRequested, setSetupRequested] = useState(false);
  useEffect(() => {
    const update = () => {
      setResultsOpen(!!document.querySelector('[data-tour="results-panel"]'));
      setCompleted(!!document.querySelector('[data-playback-complete="true"]'));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-playback-complete"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  const baseline = useRef({
    session: workspace.sessionId,
    ids: new Set(workspace.document!.scenario.nodes.map((node) => node.id)),
  });
  const scenario = workspace.document!.scenario;
  const accountSelector = accountId
    ? `.react-flow__node[data-id="${CSS.escape(accountId)}"]`
    : "";
  const merchantSelector = merchantId
    ? `.react-flow__node[data-id="${CSS.escape(merchantId)}"]`
    : "";
  const inspector = '.inspector:not([aria-hidden="true"])';
  const drawer = panel === "add";
  const action = {
    prepare: {
      title: "Finish your current edit",
      text: "Apply or cancel your current edit first. The tour will continue automatically; your existing work stays on the board.",
      selectors: [inspector],
    },
    group: {
      title: "Open a group",
      text: "Click a group to explore it. Keep opening groups until individual objects appear; then we can build together.",
      selectors: [".transaction-sector", ".hierarchy-navigation"],
    },
    objects: {
      title: "Open Objects",
      text: "Click Objects to open the drawer. We'll build a practice payment on this board. These are real edits; you can undo them after the tour.",
      selectors: [".objects-toggle"],
    },
    account: {
      title: "Add an account",
      text: drawer
        ? "Drag Account from the drawer into an open area of the canvas. Or select Account, then choose Place at center."
        : "Open Objects and add an account to the canvas. The tour moves on when it has been placed.",
      selectors: [
        drawer ? '[data-tray-id="tray-account"]' : ".objects-toggle",
        ".placement-bar",
      ],
    },
    edit: {
      title: "Set up your account",
      text: "Give your account a name, then click Create starter context directly below it. This saves the name and adds its device and location in one step.",
      selectors:
        workspace.selection?.id === accountId
          ? [
              '[data-tour="starter-context"]',
              `${inspector} label:has(input[name="name"])`,
            ]
          : [accountSelector],
    },
    merchant: {
      title: "Add a merchant",
      text: drawer
        ? "Drag Merchant into an open area near your account. Or select Merchant, then choose Place at center."
        : "Open Objects again, then drag Merchant into an open area near your account.",
      selectors: [
        drawer ? '[data-tray-id="tray-merchant"]' : ".objects-toggle",
        ".placement-bar",
      ],
    },
    connect: {
      title: "Connect your two objects",
      text: "Hold the right mouse button on your account, drag to your new merchant, and release. With a keyboard, focus the account and press C, then select the merchant.",
      selectors: [accountSelector, merchantSelector],
    },
    payment: {
      title: "Save the practice payment",
      text: "Check the amount and time, then choose Add. Device and location are already connected. Additional information is optional; blank fields use defaults.",
      selectors: [inspector],
    },
    simulate: {
      title: simulation.viewing
        ? completed
          ? "Your review is ready"
          : "Watch the payment flow"
        : "Simulate your graph",
      text: simulation.error
        ? `The simulation did not finish: ${simulation.error} Fix the issue and try Simulate again.`
        : simulation.pending
          ? "The simulation is running. The tour will continue when the results are ready."
          : simulation.viewing
            ? completed
              ? "The payment has been assessed. Choose Next to explore the results."
              : "Watch the payment travel through your graph and receive its review ranking."
            : "Click Simulate, or Next, to watch your payment move through the graph.",
      selectors: simulation.viewing
        ? [".playback button:nth-child(2)"]
        : [".tools .simulate"],
    },
    results: {
      title: "Explore your results",
      text: resultsOpen
        ? "Results summarizes payment totals, review priorities, and workload across the full run. Take a look, then choose Next when you are ready."
        : "Click Results, or Next, for payment totals, review priorities, and workload across the full run.",
      selectors: ['[data-tour="results"]', '[data-tour="results-panel"]'],
    },
    samples: {
      title: "Try a sample graph",
      text: "Open Samples to explore ready-made graphs, from a few payments to thousands of transactions. Choose one to continue experimenting.",
      selectors: ['[data-tour="samples"]', '[data-tour="results-panel"]'],
    },
  }[phase];

  useEffect(() => {
    // Clear the completed form before opening the drawer or connecting objects.
    if (
      (phase === "merchant" || phase === "connect") &&
      workspace.selection &&
      !workspace.dirty
    )
      workspace.select(null);
  }, [phase, workspace]);

  // Advance on completed application actions, not on a click that may fail validation.
  useEffect(() => {
    if (closing) return;
    if (baseline.current.session !== workspace.sessionId) {
      baseline.current = {
        session: workspace.sessionId,
        ids: new Set(scenario.nodes.map((node) => node.id)),
      };
      setAccountId("");
      setMerchantId("");
      setPaymentId("");
      setPhase(workspace.dirty ? "prepare" : showObjects ? "objects" : "group");
      return;
    }
    // An object can be undone or deleted while the tour is active.
    if (accountId && !scenario.nodes.some((node) => node.id === accountId)) {
      setAccountId("");
      setMerchantId("");
      setPaymentId("");
      setPhase("account");
      return;
    }
    if (merchantId && !scenario.nodes.some((node) => node.id === merchantId)) {
      setMerchantId("");
      setPaymentId("");
      setPhase("merchant");
      return;
    }
    if (phase === "prepare" && !workspace.dirty)
      setPhase(showObjects ? "objects" : "group");
    if (phase === "group" && showObjects) setPhase("objects");
    if (phase === "objects" && drawer) setPhase("account");
    if (phase === "account") {
      const added = scenario.nodes.find(
        (node) => node.type === "account" && !baseline.current.ids.has(node.id),
      );
      if (added) {
        setAccountId(added.id);
        setPhase("edit");
      }
    }
    if (
      phase === "edit" &&
      ["accountDevice", "accountLocation"].every((type) =>
        scenario.associations.some(
          (link) => link.accountId === accountId && link.type === type,
        ),
      )
    )
      setPhase("merchant");
    if (phase === "merchant") {
      const added = scenario.nodes.find(
        (node) =>
          node.type === "merchant" && !baseline.current.ids.has(node.id),
      );
      if (added) {
        setMerchantId(added.id);
        setPhase("connect");
      }
    }
    if (
      phase === "connect" &&
      draft?.kind === "payment" &&
      draft.record.accountId === accountId &&
      draft.record.merchantId === merchantId
    ) {
      setPaymentId(draft.record.id);
      setPhase("payment");
    }
    const saved = scenario.payments.some((payment) => payment.id === paymentId);
    if (phase === "payment") {
      if (saved) setPhase("simulate");
      else if (!draft) setPhase("connect");
    }
    if (phase === "simulate" && !saved) setPhase("connect");
    if (
      phase === "simulate" &&
      saved &&
      simulation.viewing &&
      completed &&
      !simulation.playing
    )
      setPhase("results");
    if (phase === "results" && !simulation.viewing) setPhase("simulate");
  }, [
    phase,
    closing,
    workspace,
    scenario,
    showObjects,
    drawer,
    accountId,
    merchantId,
    paymentId,
    draft,
    simulation.viewing,
    simulation.playing,
    completed,
  ]);
  useEffect(() => {
    if (setupRequested && workspace.selection?.id === accountId) {
      click('[data-tour="starter-context"]');
      setSetupRequested(false);
    }
  }, [setupRequested, workspace.selection, accountId]);
  function next() {
    if (phase === "prepare" || phase === "payment") submitTutorialForm();
    if (phase === "group") click(".sector-label");
    if (phase === "objects") click(".objects-toggle");
    if (phase === "account") addObject("account");
    if (phase === "edit") {
      if (workspace.selection?.id === accountId)
        click('[data-tour="starter-context"]');
      else {
        workspace.select({ kind: "node", id: accountId });
        setSetupRequested(true);
      }
    }
    if (phase === "merchant") addObject("merchant");
    if (phase === "connect") connectObjects(accountId, merchantId);
    if (phase === "simulate") {
      if (!simulation.viewing) click(".tools .simulate");
      else if (completed) setPhase("results");
      else click(".playback button:nth-child(2)");
    }
    if (phase === "results") {
      if (resultsOpen) setPhase("samples");
      else click('[data-tour="results"]');
    }
    if (phase === "samples") click('[data-tour="samples"]');
  }
  useEffect(() => {
    if (phase === "samples" && samplesOpen) setClosing(true);
  }, [phase, samplesOpen]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(close, panelDuration());
    return () => clearTimeout(timer);
  }, [closing, close]);
  return (
    <TutorialSpotlight
      phase={phase}
      selectors={action.selectors}
      allowed={
        phase === "simulate" && simulation.viewing
          ? [".playback button:nth-child(2)", ".playback-speed"]
          : action.selectors
      }
      dim={!(phase === "simulate" && simulation.viewing && !completed)}
      avoid={phase === "simulate" && simulation.viewing ? [".playback"] : []}
      title={action.title}
      text={action.text}
      label={`Hands-on tour${sequence.includes(phase) ? ` · ${sequence.indexOf(phase) + 1} of ${sequence.length}` : ""}`}
      step={sequence.indexOf(phase)}
      steps={sequence.length}
      closing={closing}
      close={() => setClosing(true)}
      enabled={!samplesOpen}
    >
      <div className="inline-actions">
        <button
          className="primary"
          onClick={next}
          disabled={
            closing ||
            simulation.pending ||
            (phase === "simulate" &&
              simulation.viewing &&
              simulation.playing &&
              !completed)
          }
        >
          Next
        </button>
        {(phase === "objects" || phase === "group" || phase === "prepare") && (
          <button onClick={() => setClosing(true)}>Skip tour</button>
        )}
      </div>
    </TutorialSpotlight>
  );
}
