import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon } from "../CloseIcon";
import { panelDuration } from "../Presence";
import { useWorkspace } from "../../state/workspace";
import { useSimulation } from "../../state/simulation";
import type { Draft } from "./draft";
import { useTutorialInteractions } from "./useTutorialInteractions";

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
type Bounds = { x: number; y: number; width: number; height: number };

// Partition the viewport into empty rectangles, keeping both connection
// endpoints clear even when a panel or another element obscures them.
function connectionSpace(
  viewport: { width: number; height: number },
  obstacles: Bounds[],
  height: number,
) {
  let spaces: Bounds[] = [
    { x: 12, y: 12, width: viewport.width - 24, height: viewport.height - 24 },
  ];
  for (const node of obstacles) {
    const left = node.x - 12,
      right = node.x + node.width + 12;
    const top = node.y - 12,
      bottom = node.y + node.height + 12;
    spaces = spaces.flatMap((space) => {
      const endX = space.x + space.width,
        endY = space.y + space.height;
      if (right <= space.x || left >= endX || bottom <= space.y || top >= endY)
        return [space];
      return [
        { ...space, width: left - space.x },
        { ...space, x: right, width: endX - right },
        { ...space, height: top - space.y },
        { ...space, y: bottom, height: endY - bottom },
      ].filter((area) => area.width > 0 && area.height > 0);
    });
  }
  const readable = spaces.filter(
    (area) => area.width >= Math.min(260, viewport.width - 24),
  );
  return (readable.length ? readable : spaces).sort(
    (a, b) =>
      Math.min(370, b.width) * Math.min(height, b.height) -
      Math.min(370, a.width) * Math.min(height, a.height),
  )[0];
}

export function WorkspaceTutorial({
  close,
  showObjects,
  panel,
  draft,
  samplesOpen,
}: {
  close: () => void;
  showObjects: boolean;
  panel: string | null;
  draft: Draft | null;
  samplesOpen: boolean;
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
  const baseline = useRef({
    session: workspace.sessionId,
    ids: new Set(workspace.document!.scenario.nodes.map((node) => node.id)),
  });
  const [bounds, setBounds] = useState<(Bounds & { selector: string })[]>([]);
  const [viewport, setViewport] = useState({
    width: innerWidth,
    height: innerHeight,
  });
  const [height, setHeight] = useState(250);
  const coach = useRef<HTMLElement>(null);
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
      title: "Simulate your graph",
      text: simulation.error
        ? `The simulation did not finish: ${simulation.error} Fix the issue and try Simulate again.`
        : simulation.pending
          ? "The simulation is running. The tour will continue when the results are ready."
          : "Click Simulate to see the results.",
      selectors: [".tools .simulate"],
    },
    results: {
      title: "Explore your results",
      text: "Click Results for payment totals, risk scores, and review workload across the full run. Labeled examples also provide accuracy measures and illustrative costs.",
      selectors: ['[data-tour="results"]', '[data-tour="results-panel"]'],
    },
    samples: {
      title: "Try a sample graph",
      text: "Open Samples to explore ready-made graphs, from a few payments to thousands of transactions. Choose one to continue experimenting.",
      selectors: ['[data-tour="samples"]', '[data-tour="results-panel"]'],
    },
  }[phase];
  const selectorKey = action.selectors.filter(Boolean).join("|");
  useTutorialInteractions(selectorKey, !samplesOpen);

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
    if (phase === "simulate" && simulation.viewing) setPhase("results");
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
  ]);
  useEffect(() => {
    if (phase !== "results" || closing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      if (document.querySelector('[data-tour="results-panel"]')) {
        // Leave time to read the results before introducing the final step.
        timer ??= setTimeout(() => setPhase("samples"), 2500);
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const observer = new MutationObserver(advance);
    observer.observe(document.body, { childList: true, subtree: true });
    advance();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [phase, closing]);
  useEffect(() => {
    if (phase === "samples" && samplesOpen) setClosing(true);
  }, [phase, samplesOpen]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(close, panelDuration());
    return () => clearTimeout(timer);
  }, [closing, close]);
  useEffect(() => {
    document.documentElement.dataset.tutorial = "on";
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        useWorkspace.getState().dragging ||
        document.querySelector(".connection-preview")
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("form, dialog")
      )
        return;
      event.stopImmediatePropagation();
      event.preventDefault();
      setClosing(true);
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
      delete document.documentElement.dataset.tutorial;
      document.documentElement.style.removeProperty("--tour-coach-height");
    };
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--tour-coach-height",
      `${height}px`,
    );
  }, [height]);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const next = selectorKey
        .split("|")
        .filter(Boolean)
        .flatMap((selector) => {
          const element = document.querySelector(selector);
          if (!element || element.closest('[inert], [aria-hidden="true"]'))
            return [];
          const rect = element.getBoundingClientRect();
          if (phase !== "connect" && element.matches(".react-flow__node")) {
            const hit = document
              .elementsFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              )
              .find((target) => !target.closest(".tutorial-tour"));
            // A mobile inspector can cover the object on the canvas.
            if (!hit || !element.contains(hit)) return [];
          }
          if (
            !rect.width ||
            !rect.height ||
            rect.right <= 0 ||
            rect.bottom <= 0 ||
            rect.left >= innerWidth ||
            rect.top >= innerHeight
          )
            return [];
          return [
            {
              x: Math.max(0, rect.x - 6),
              selector,
              y: Math.max(0, rect.y - 6),
              width:
                Math.min(innerWidth, rect.right + 6) - Math.max(0, rect.x - 6),
              height:
                Math.min(innerHeight, rect.bottom + 6) -
                Math.max(0, rect.y - 6),
            },
          ];
        });
      setBounds((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
      setViewport((old) =>
        old.width === innerWidth && old.height === innerHeight
          ? old
          : { width: innerWidth, height: innerHeight },
      );
      const measured = coach.current?.getBoundingClientRect().height;
      if (measured) setHeight((old) => (old === measured ? old : measured));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [selectorKey, phase]);

  const width = Math.min(370, viewport.width - 24);
  const primary = bounds[0];
  const clamp = (point: { x: number; y: number }) => ({
    x: Math.max(12, Math.min(point.x, viewport.width - width - 12)),
    y: Math.max(12, Math.min(point.y, viewport.height - height - 12)),
  });
  const candidates = [
    ...(primary
      ? [
          { x: primary.x + primary.width + 18, y: primary.y },
          { x: primary.x - width - 18, y: primary.y },
          { x: primary.x, y: primary.y + primary.height + 18 },
          { x: primary.x, y: primary.y - height - 18 },
        ]
      : []),
    { x: viewport.width - width - 16, y: viewport.height - height - 100 },
    { x: 16, y: viewport.height - height - 100 },
  ].map(clamp);
  const overlap = (point: { x: number; y: number }) =>
    bounds.reduce(
      (sum, rect) =>
        sum +
        Math.max(
          0,
          Math.min(point.x + width, rect.x + rect.width) -
            Math.max(point.x, rect.x),
        ) *
          Math.max(
            0,
            Math.min(point.y + height, rect.y + rect.height) -
              Math.max(point.y, rect.y),
          ),
      0,
    );
  const mobileCandidates = [
    { x: 12, y: viewport.height - height - 12 },
    { x: 12, y: 12 },
    ...bounds.map((rect) => ({ x: 12, y: rect.y - height - 12 })),
  ].map(clamp);
  const position = (viewport.width <= 600 ? mobileCandidates : candidates).sort(
    (a, b) => overlap(a) - overlap(b),
  )[0]!;
  const space =
    phase === "connect" ? connectionSpace(viewport, bounds, height) : undefined;
  const blockerPath =
    `M0 0H${viewport.width}V${viewport.height}H0Z` +
    bounds
      .map(
        (rect) =>
          `M${rect.x} ${rect.y}h${rect.width}v${rect.height}h${-rect.width}Z`,
      )
      .join("");
  const connection =
    phase === "connect" && bounds.length === 2
      ? bounds.map((rect) => ({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }))
      : null;

  return (
    <div className="tutorial-tour" data-phase={phase} data-closing={closing}>
      <svg className="tour-shade" width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="tutorial-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {bounds.map(({ selector, ...rect }) => (
              <rect key={selector} {...rect} rx="10" fill="black" />
            ))}
          </mask>
        </defs>
        <rect
          className="tour-dimmer"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.62)"
          mask="url(#tutorial-spotlight)"
        />
        <path
          className="tour-blocker"
          d={blockerPath}
          fill="transparent"
          fillRule="evenodd"
        />
        {connection && (
          <line
            className="tour-connection-guide"
            x1={connection[0]!.x}
            y1={connection[0]!.y}
            x2={connection[1]!.x}
            y2={connection[1]!.y}
            pathLength="1"
          />
        )}
        {bounds.map(({ selector, ...rect }) => (
          <rect
            key={selector}
            data-tour-target={selector}
            className="tour-focus"
            {...rect}
            rx="10"
          />
        ))}
      </svg>
      <section
        ref={coach}
        tabIndex={-1}
        className="tour-coach card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-text"
        style={
          space
            ? {
                left: space.x,
                top: space.y,
                width: Math.min(width, space.width),
                maxHeight: space.height,
              }
            : { left: position.x, top: position.y, width }
        }
      >
        <button
          className="close"
          aria-label="Close tutorial"
          onClick={() => setClosing(true)}
        >
          <CloseIcon />
        </button>
        <div className="kicker">
          Hands-on tour
          {sequence.includes(phase)
            ? ` · ${sequence.indexOf(phase) + 1} of ${sequence.length}`
            : ""}
        </div>
        <div aria-live="polite">
          <h2 id="tutorial-title">{action.title}</h2>
          <p id="tutorial-text">{action.text}</p>
        </div>
        <div className="tour-progress" aria-hidden="true">
          {sequence.map((item) => (
            <i key={item} data-current={item === phase} />
          ))}
        </div>
        <button onClick={() => setClosing(true)}>Skip tour</button>
      </section>
    </div>
  );
}
