import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon } from "../CloseIcon";
import { useWorkspace } from "../../state/workspace";
import { useTutorialInteractions } from "./useTutorialInteractions";

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

export function TutorialSpotlight({
  phase,
  selectors,
  allowed = selectors,
  title,
  text,
  label,
  step,
  steps,
  close,
  closing = false,
  enabled = true,
  freeCanvas = false,
  pathSelector,
  readOnly = [],
  dim = true,
  avoid = [],
  children,
}: {
  phase: string;
  selectors: string[];
  allowed?: string[];
  title: string;
  text: string;
  label: string;
  step: number;
  steps: number;
  close: () => void;
  closing?: boolean;
  enabled?: boolean;
  freeCanvas?: boolean;
  pathSelector?: string | undefined;
  readOnly?: string[];
  dim?: boolean;
  avoid?: string[];
  children?: ReactNode;
}) {
  const [bounds, setBounds] = useState<(Bounds & { selector: string })[]>([]);
  const [viewport, setViewport] = useState({
    width: innerWidth,
    height: innerHeight,
  });
  const [height, setHeight] = useState(250);
  const [path, setPath] = useState<{ d: string; transform: string } | null>(
    null,
  );
  const coach = useRef<HTMLElement>(null);
  const previousHeight = useRef<number | null>(null);
  const resizing = useRef<{ height: number; animation: Animation } | null>(
    null,
  );
  useLayoutEffect(() => {
    const element = coach.current;
    if (!element) return;
    const height = element.offsetHeight;
    const before = previousHeight.current;
    previousHeight.current = height;
    setHeight(height);
    if (
      before === null ||
      before === height ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const animation = element.animate(
      [{ height: `${before}px` }, { height: `${height}px` }],
      { duration: 320, easing: "ease-in-out" },
    );
    resizing.current = { height, animation };
    return () => {
      animation.cancel();
      resizing.current = null;
    };
  }, [phase, title, text]);
  const onClose = useRef(close);
  useLayoutEffect(() => {
    onClose.current = close;
  }, [close]);
  const selectorKey = [...selectors, pathSelector, ...avoid]
    .filter(Boolean)
    .join("|");
  useTutorialInteractions(
    allowed.filter(Boolean).join("|"),
    enabled,
    readOnly.join("|"),
  );
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
      onClose.current();
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
      const curve = pathSelector
        ? document.querySelector<SVGPathElement>(pathSelector)
        : null;
      const matrix = curve?.getScreenCTM();
      const nextPath =
        curve && matrix
          ? {
              d: curve.getAttribute("d") || "",
              transform: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`,
            }
          : null;
      setPath((old) =>
        JSON.stringify(old) === JSON.stringify(nextPath) ? old : nextPath,
      );
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
      // Place the card using its destination size so growing it and moving it
      // upward stay in sync, especially along the bottom of a mobile screen.
      const measured =
        resizing.current?.animation.playState === "running"
          ? resizing.current.height
          : coach.current?.getBoundingClientRect().height;
      if (measured) setHeight((old) => (old === measured ? old : measured));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [selectorKey, phase, pathSelector]);

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
      .filter(
        (rect) =>
          !bounds.some(
            (other) =>
              other !== rect &&
              other.x <= rect.x &&
              other.y <= rect.y &&
              other.x + other.width >= rect.x + rect.width &&
              other.y + other.height >= rect.y + rect.height,
          ),
      )
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
    <div
      className="tutorial-tour"
      data-phase={phase}
      data-closing={closing}
      data-graph-tour={freeCanvas || undefined}
    >
      <svg className="tour-shade" width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="tutorial-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {bounds
              .filter(
                (rect) =>
                  rect.selector !== pathSelector &&
                  !avoid.includes(rect.selector),
              )
              .map(({ selector, ...rect }) => (
                <rect key={selector} {...rect} rx="10" fill="black" />
              ))}
            {path && (
              <path
                {...path}
                fill="none"
                stroke="black"
                strokeWidth="22"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </mask>
        </defs>
        <rect
          className="tour-dimmer"
          width="100%"
          height="100%"
          fill={dim ? "rgba(0, 0, 0, 0.62)" : "transparent"}
          mask="url(#tutorial-spotlight)"
        />
        <path
          className="tour-blocker"
          style={freeCanvas ? { pointerEvents: "none" } : undefined}
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
        {path && (
          <path
            {...path}
            className="tour-path-glow"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {bounds
          .filter(
            (rect) =>
              rect.selector !== pathSelector && !avoid.includes(rect.selector),
          )
          .map(({ selector, ...rect }) => (
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
        <button className="close" aria-label="Close tutorial" onClick={close}>
          <CloseIcon />
        </button>
        <div className="kicker">{label}</div>
        <div
          key={`${phase}:${title}:${text}`}
          className="tour-copy"
          aria-live="polite"
        >
          <h2 id="tutorial-title">{title}</h2>
          <p id="tutorial-text">{text}</p>
        </div>
        <div className="tour-progress" aria-hidden="true">
          {Array.from({ length: steps }, (_, index) => (
            <i key={index} data-current={index === step} />
          ))}
        </div>
        {children}
      </section>
    </div>
  );
}
