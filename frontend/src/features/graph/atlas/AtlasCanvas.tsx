import { useWorkspace } from "../../../state/workspace";
import { growthTree, GROWTH_DURATION, GROWTH_WAVE_DURATION } from "../growth";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ViewportPortal,
  useStore,
  useStoreApi,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import type { Entity, Position } from "../../../domain/types";
import { groupLabel } from "../../../domain/hierarchy";
import { sectorOffset, type Sector } from "./model";
import { sectorCloud, sectorColour, sectorHue } from "./point-cloud";
import { territoryPath } from "./layout";
import {
  sectorConnections,
  visibleConnections,
  previewConnections,
  type SectorConnection,
} from "./connections";
import { ConnectionDetails } from "./ConnectionDetails";
import "./atlas.css";
import type { ReviewGroup } from "../../../domain/runInsights";

function bridgePath(link: SectorConnection) {
  const a = link.start,
    b = link.end,
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(70, length * 0.06);
  return `M${a.x},${a.y}Q${(a.x + b.x) / 2 - (dy / length) * bend},${(a.y + b.y) / 2 + (dx / length) * bend} ${b.x},${b.y}`;
}
function BridgeTargets({
  links,
  select,
}: {
  links: SectorConnection[];
  select: (link: SectorConnection) => void;
}) {
  const zoom = useStore((s) => s.transform[2]);
  const gradientId = useId();
  return (
    <ViewportPortal>
      <svg
        className="connection-targets"
        width="1"
        height="1"
        overflow="visible"
      >
        <defs>
          {links.map((link, index) => (
            <linearGradient
              key={link.id}
              id={`${gradientId}-${index}`}
              gradientUnits="userSpaceOnUse"
              x1={link.start.x}
              y1={link.start.y}
              x2={link.end.x}
              y2={link.end.y}
            >
              <stop
                offset="0"
                style={{
                  stopColor: `hsl(${sectorHue(link.a.id)} var(--sector-saturation) var(--sector-lightness))`,
                }}
              />
              <stop
                offset="1"
                style={{
                  stopColor: `hsl(${sectorHue(link.b.id)} var(--sector-saturation) var(--sector-lightness))`,
                }}
              />
            </linearGradient>
          ))}
        </defs>
        {links.map((l, index) => (
          <g key={l.id} className="connection-control">
            <path
              d={bridgePath(l)}
              data-connection={l.id}
              className="connection-target nopan nodrag"
              role="button"
              tabIndex={0}
              aria-label={`Connection between ${groupLabel(l.a)} and ${groupLabel(l.b)}, ${l.entities.length} shared objects`}
              style={{ strokeWidth: 12 / zoom }}
              onClick={(e) => {
                e.stopPropagation();
                select(l);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(l);
                }
              }}
            >
              <title>
                {l.entities.length} shared objects - Select for source payments
              </title>
            </path>
            <path
              className="connection-hover"
              d={bridgePath(l)}
              style={{
                stroke: `url(#${gradientId}-${index})`,
                strokeWidth: 1.2 / zoom,
              }}
              aria-hidden="true"
            />
          </g>
        ))}
      </svg>
    </ViewportPortal>
  );
}

type TerritoryNode = Node<
  {
    sector: Sector;
    enter: (id: string) => void;
    disabled: boolean;
    reviewCount: number;
    inspectReviews: (() => void) | undefined;
    flaggedOnly: boolean;
  },
  "territory"
>;
function Territory({ data }: NodeProps<TerritoryNode>) {
  const zoom = useStore((s) => s.transform[2]);
  const { sector } = data;
  const r = sector.radius;
  return (
    <div
      className="transaction-sector nodrag"
      role="group"
      tabIndex={-1}
      data-leaf={sector.children.length === 0}
      data-payment-count={sector.group.payments.length}
      data-review-count={data.reviewCount}
      data-muted={data.flaggedOnly && !data.reviewCount}
      aria-label={groupLabel(sector.group)}
      aria-description={sector.group.reason}
      title={`${groupLabel(sector.group)}\n${sector.group.reason}`}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !data.disabled &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          data.enter(sector.group.id);
        }
      }}
      style={{ width: r * 2, height: r * 2, fontSize: 12 / zoom }}
    >
      <button
        className="sector-open"
        tabIndex={-1}
        disabled={data.disabled}
        onClick={() => data.enter(sector.group.id)}
        aria-label={`Open cluster area ${groupLabel(sector.group)}`}
      >
        <svg
          viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}
          width={r * 2}
          height={r * 2}
          aria-hidden="true"
        >
          <path
            className="territory-hit"
            data-sector={sector.group.id}
            d={territoryPath(sector.territory)}
          />
        </svg>
      </button>
      <span
        className={`sector-name${r * zoom < Math.min(85, Math.max(32, groupLabel(sector.group).length * 2)) ? " sector-name-crowded" : ""}`}
        style={{
          maxWidth: Math.max(100, Math.min(264, r * 2 * zoom * 0.9)) / zoom,
        }}
      >
        <button
          className="sector-label"
          disabled={data.disabled}
          onClick={() => data.enter(sector.group.id)}
          aria-label={`Open ${groupLabel(sector.group)}, ${sector.group.payments.length.toLocaleString()} payments`}
        >
          <span className="sector-factor-label">
            {groupLabel(sector.group)}
          </span>
        </button>{" "}
        {data.reviewCount > 0 && (
          <button
            className="sector-review-count nodrag nopan"
            disabled={data.disabled || !data.inspectReviews}
            aria-label={`${data.reviewCount} for review in ${groupLabel(sector.group)}: inspect payments`}
            onClick={(e) => {
              e.stopPropagation();
              data.inspectReviews?.();
            }}
          >
            {data.reviewCount} for review
          </button>
        )}{" "}
        <span className="sector-payment-count">
          {sector.group.payments.length.toLocaleString()} payments
        </span>
      </span>
    </div>
  );
}
const nodeTypes = { territory: Territory };

function MapLayer({
  root,
  sector,
  entities,
  connections,
  highlight,
}: {
  root: Sector;
  sector: Sector;
  entities: Entity[];
  connections: SectorConnection[];
  highlight: { link: SectorConnection; entityId: string } | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const revealing = useWorkspace((s) => s.revealGraph);
  const growthStarted = useRef<number | null>(null);
  const store = useStoreApi();
  const geometry = useMemo(
    () => sectorCloud(root, new Map(entities.map((e) => [e.id, e]))),
    [root, entities],
  );
  const branches = useMemo(
    () => growthTree(geometry.points, geometry.links),
    [geometry],
  );
  const arrivals = useMemo(
    () => new Map(branches.map((b) => [b.point, b.time])),
    [branches],
  );
  const offset = useMemo(
    () => sectorOffset(root, sector.group.id)!,
    [root, sector.group.id],
  );
  const previewLinks = useMemo(
    () => previewConnections(sector, entities),
    [sector, entities],
  );
  const previousColours = useRef(new Map<string, number>());
  const previousFocus = useRef("");
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d", { alpha: true })!;
    let frame = 0,
      width = 0,
      height = 0;
    const start =
      previousFocus.current === sector.group.id ? -Infinity : performance.now();
    previousFocus.current = sector.group.id;
    const reduce =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "off";
    if (revealing && growthStarted.current === null)
      growthStarted.current = performance.now();
    if (!revealing) growthStarted.current = null;
    const batches = new Map<string, typeof geometry.points>();
    const depth = sector.group.id.split("/").length;
    for (const point of geometry.points) {
      const active = point.leaf.startsWith(sector.group.id + "/");
      const id = active
        ? point.leaf
            .split("/")
            .slice(0, depth + 1)
            .join("/")
        : point.leaf.split("/").slice(0, 2).join("/");
      const key = `${active ? "in" : "out"}:${id}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(point);
    }
    const oldColours = new Map(previousColours.current);
    const colours = new Map<string, number>();
    for (const [key, points] of batches)
      for (const point of points)
        colours.set(
          `${point.leaf}:${point.id}`,
          sectorHue(key.slice(key.indexOf(":") + 1)),
        );
    previousColours.current = colours;
    // Keep the account/merchant structure readable after the import animation
    // settles. Batch by sector so large overviews remain canvas-only.
    const networkPaths = new Map<
      string,
      { path: Path2D; point: (typeof geometry.points)[number]; active: boolean }
    >();
    for (const [a, b] of geometry.links) {
      const key = a.leaf
        .split("/")
        .slice(0, a.leaf.startsWith(sector.group.id + "/") ? depth + 1 : 2)
        .join("/");
      let batch = networkPaths.get(key);
      if (!batch) {
        batch = {
          path: new Path2D(),
          point: a,
          active: a.leaf.startsWith(sector.group.id + "/"),
        };
        networkPaths.set(key, batch);
      }
      batch.path.moveTo(a.x, a.y);
      batch.path.lineTo(b.x, b.y);
    }
    const previews = previewLinks.map((link) => new Path2D(bridgePath(link)));
    const bridges = connections.map((link) => ({
      link,
      path: new Path2D(bridgePath(link)),
    }));
    const highlighted = highlight
      ? geometry.points.filter(
          (p) =>
            p.id === highlight.entityId &&
            [highlight.link.a.id, highlight.link.b.id].some(
              (id) => p.leaf === id || p.leaf.startsWith(id + "/"),
            ),
        )
      : [];
    const draw = () => {
      frame = 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const box = element.getBoundingClientRect();
      if (width !== box.width || height !== box.height) {
        width = box.width;
        height = box.height;
        element.width = Math.round(width * dpr);
        element.height = Math.round(height * dpr);
      }
      const [vx, vy, zoom] = store.getState().transform;
      const tx = vx - offset.x * zoom,
        ty = vy - offset.y * zoom;
      const dark = document.documentElement.dataset.theme === "dark";
      const fade = reduce ? 1 : Math.min(1, (performance.now() - start) / 360);
      const age =
        !reduce && revealing && growthStarted.current !== null
          ? performance.now() - growthStarted.current
          : GROWTH_DURATION;
      const settled = Math.max(
        0,
        Math.min(1, (age - (GROWTH_DURATION - 1200)) / 1200),
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * tx, dpr * ty);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.strokeStyle = dark ? "#74828d" : "#9aa5ac";
      ctx.globalAlpha = 0.2 * fade * settled;
      ctx.lineWidth = 0.7 / zoom;
      for (const path of previews) ctx.stroke(path);
      for (const [index, { link, path }] of bridges.entries()) {
        const rank = index / Math.max(1, connections.length - 1);
        const selected = highlight?.link.id === link.id;
        if (selected) {
          const gradient = ctx.createLinearGradient(
            link.start.x,
            link.start.y,
            link.end.x,
            link.end.y,
          );
          gradient.addColorStop(0, sectorColour(sectorHue(link.a.id), dark));
          gradient.addColorStop(1, sectorColour(sectorHue(link.b.id), dark));
          ctx.strokeStyle = gradient;
        } else
          ctx.strokeStyle =
            rank < 0.3
              ? dark
                ? "#90adc3"
                : "#66869d"
              : rank < 0.7
                ? dark
                  ? "#899aa5"
                  : "#7f909b"
                : dark
                  ? "#74828d"
                  : "#9aa5ac";
        ctx.globalAlpha = selected
          ? 0.95
          : rank < 0.3
            ? 0.44
            : rank < 0.7
              ? 0.34
              : 0.26;
        ctx.globalAlpha *= settled;
        ctx.lineWidth = (selected ? 1.5 : 0.8) / zoom;
        ctx.stroke(path);
      }
      ctx.restore();
      for (const { path, point, active } of networkPaths.values()) {
        const hue = colours.get(`${point.leaf}:${point.id}`)!;
        ctx.strokeStyle = sectorColour(hue, dark);
        ctx.globalAlpha = (active ? 0.38 : 0.14) * settled;
        ctx.lineWidth = 0.7 / zoom;
        ctx.stroke(path);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (age >= GROWTH_WAVE_DURATION && age < GROWTH_DURATION) {
        ctx.strokeStyle = "#91bac5";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.45 * (1 - settled);
        ctx.beginPath();
        for (const { point, parent, time } of branches) {
          const progress = Math.max(0, Math.min(1, (age - time + 350) / 350));
          if (!progress || point === parent) continue;
          const x = parent.x * zoom + tx,
            y = parent.y * zoom + ty;
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + (point.x - parent.x) * zoom * progress,
            y + (point.y - parent.y) * zoom * progress,
          );
        }
        ctx.stroke();
      }
      for (const [key, points] of batches) {
        const first = points[0]!;
        const hue = colours.get(`${first.leaf}:${first.id}`)!;
        const old = oldColours.get(`${first.leaf}:${first.id}`) ?? hue;
        const mixed = old + (((hue - old + 540) % 360) - 180) * fade;
        ctx.fillStyle = sectorColour(mixed, dark);
        const contextVisibility =
          0.24 +
          0.4 *
            Math.max(
              0,
              1 - (sector.radius * zoom * 2) / Math.max(1, height * 0.7),
            );
        ctx.globalAlpha = key.startsWith("in:") ? 0.9 : contextVisibility;
        ctx.beginPath();
        const radius = Math.min(2, 1.25 + zoom * 0.7);
        for (const p of points) {
          const x = p.x * zoom + tx,
            y = p.y * zoom + ty;
          if (x < -3 || y < -3 || x > width + 3 || y > height + 3) continue;
          const grown =
            radius *
            Math.max(0, Math.min(1, (age - (arrivals.get(p) || 0)) / 400));
          if (!grown) continue;
          ctx.moveTo(x + grown, y);
          ctx.arc(x, y, grown, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.3;
      for (const p of highlighted) {
        const hue = colours.get(`${p.leaf}:${p.id}`)!;
        ctx.strokeStyle = sectorColour(hue, dark);
        ctx.fillStyle = sectorColour(hue, dark);
        const x = p.x * zoom + tx,
          y = p.y * zoom + ty;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      element.dataset.paintCount = String(
        Number(element.dataset.paintCount || 0) + 1,
      );
      if (fade < 1 || age < GROWTH_DURATION) schedule();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.transform !== previous.transform) schedule();
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      resize.disconnect();
      theme.disconnect();
    };
  }, [
    geometry,
    sector,
    offset,
    store,
    connections,
    highlight,
    previewLinks,
    revealing,
    branches,
    arrivals,
  ]);
  return (
    <canvas
      className="atlas-cloud"
      ref={canvas}
      aria-hidden="true"
      data-cloud-points={geometry.points.length}
      data-cloud-payments={geometry.payments}
      data-visible-connections={connections.length}
      data-preview-connections={previewLinks.length}
      data-highlighted-entity={highlight?.entityId ?? ""}
    />
  );
}

export const AtlasCanvas = memo(function AtlasCanvas({
  root,
  sector,
  entities,
  enter,
  viewport,
  disabled,
  inspectPayment,
  inspectReviewGroup,
  flaggedIds,
  revealedIds,
  flaggedOnly = false,
}: {
  inspectPayment?: ((id: string) => void) | undefined;
  inspectReviewGroup?: ((group: ReviewGroup) => void) | undefined;
  root: Sector;
  sector: Sector;
  entities: Entity[];
  enter: (id: string) => void;
  viewport: Viewport;
  disabled: boolean;
  flaggedIds?: ReadonlySet<string> | undefined;
  revealedIds?: readonly string[] | undefined;
  flaggedOnly?: boolean | undefined;
}) {
  const assessedIds = useMemo(
    () => (revealedIds ? new Set(revealedIds) : undefined),
    [revealedIds],
  );
  const links = useMemo(
    () => sectorConnections(sector, entities),
    [sector, entities],
  );
  const visible = useMemo(
    () =>
      visibleConnections(
        links,
        sector.group.id.split("/").length - 1,
        sector.children.length,
      ),
    [links, sector],
  );
  const [selection, setSelection] = useState<{
    group: string;
    id: string;
    entityId: string;
  } | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const selected =
    selection?.group === sector.group.id
      ? links.find((l) => l.id === selection.id)
      : undefined;
  const choose = (link: SectorConnection) =>
    setSelection({
      group: sector.group.id,
      id: link.id,
      entityId: link.witness,
    });
  const highlight = useMemo(
    () =>
      selected && selection
        ? { link: selected, entityId: selection.entityId }
        : null,
    [selected, selection],
  );
  const drawn = useMemo(
    () =>
      selected && !visible.includes(selected)
        ? [...visible, selected]
        : visible,
    [selected, visible],
  );
  const gesture = useRef<{ start: Position; pointer: number } | null>(null);
  const suppress = useRef(0);
  const nodes = useMemo<TerritoryNode[]>(
    () =>
      sector.children.map((c) => ({
        id: c.sector.group.id,
        type: "territory",
        origin: [0.5, 0.5],
        position: c.center,
        measured: { width: c.sector.radius * 2, height: c.sector.radius * 2 },
        style: { width: c.sector.radius * 2, height: c.sector.radius * 2 },
        data: {
          sector: c.sector,
          disabled,
          enter,
          flaggedOnly,
          reviewCount: c.sector.group.payments.filter((p) =>
            flaggedIds?.has(p.id),
          ).length,
          inspectReviews: inspectReviewGroup
            ? () =>
                inspectReviewGroup({
                  label: `${groupLabel(c.sector.group)} · For review`,
                  eventIds: c.sector.group.payments.map((p) => p.id),
                  visibleOnly: true,
                })
            : undefined,
        },
        ariaLabel: `${groupLabel(c.sector.group)}, ${c.sector.group.payments.length} payments`,
      })),
    [sector, disabled, enter, flaggedIds, flaggedOnly, inspectReviewGroup],
  );
  return (
    <div
      className="hierarchy-canvas atlas-canvas"
      data-testid="cluster-overview"
      data-group={sector.group.id}
      onPointerDownCapture={(e) => {
        gesture.current = {
          start: { x: e.clientX, y: e.clientY },
          pointer: e.pointerId,
        };
        suppress.current = 0;
      }}
      onPointerMoveCapture={(e) => {
        const g = gesture.current;
        if (
          g &&
          e.pointerId === g.pointer &&
          Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) > 4
        )
          suppress.current = performance.now() + 500;
      }}
      onPointerUpCapture={() => {
        gesture.current = null;
      }}
      onPointerCancelCapture={() => {
        gesture.current = null;
        suppress.current = performance.now() + 500;
      }}
      onClickCapture={(e) => {
        if (e.detail && performance.now() < suppress.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      <ReactFlow
        proOptions={{ hideAttribution: true }}
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodeOrigin={[0.5, 0.5]}
        defaultViewport={viewport}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        autoPanOnNodeFocus={false}
        deleteKeyCode={null}
        minZoom={0.0001}
        maxZoom={10000}
      >
        <BridgeTargets links={drawn} select={choose} />
      </ReactFlow>
      <MapLayer
        root={root}
        sector={sector}
        entities={entities}
        connections={drawn}
        highlight={highlight}
      />
      {selected && selection && (
        <ConnectionDetails
          key={sector.group.id}
          selected={selected}
          entityId={selection.entityId}
          chooseEntity={(entityId) => setSelection({ ...selection, entityId })}
          close={() => setSelection(null)}
          inspect={
            inspectPayment
              ? (id) => {
                  setSelection(null);
                  inspectPayment(id);
                }
              : undefined
          }
          entities={entities}
          assessedIds={assessedIds}
          flaggedIds={flaggedIds}
        />
      )}
    </div>
  );
});
