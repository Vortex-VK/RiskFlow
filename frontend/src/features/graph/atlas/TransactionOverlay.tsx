import { firingOpacity, riskOpacity } from "../growth";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Position } from "../../../domain/types";
import { useViewport } from "@xyflow/react";
import type { Entity } from "../../../domain/types";
import type { GraphProps } from "../DetailGraph";
import { sectorOffset, type Sector } from "./model";
import { sectorCloud } from "./point-cloud";

type Stroke = { a: Position; b: Position; color: string; strength: number };

// Two inexpensive line passes replace per-transaction SVG filters and DOM nodes.
const CurrentCanvas = memo(function CurrentCanvas({
  strokes,
  offset,
  kind,
}: {
  strokes: Stroke[];
  offset: Position;
  kind: "risk" | "current";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useViewport();
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = canvas.current!;
    const resize = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = canvas.current!;
    const context = element.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(size.width * dpr),
      height = Math.round(size.height * dpr);
    if (element.width !== width || element.height !== height) {
      element.width = width;
      element.height = height;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    const buckets = new Map<
      string,
      { color: string; alpha: number; boost: number; path: Path2D }
    >();
    const endpoints = new Map<
      string,
      { x: number; y: number; color: string; alpha: number; boost: number }
    >();
    let totalBoost = 0,
      visibleCount = 0;
    for (const stroke of strokes) {
      const alpha = Math.round(stroke.strength * 60) / 60;
      if (alpha <= 0) continue;
      const x1 = (stroke.a.x - offset.x) * viewport.zoom + viewport.x;
      const y1 = (stroke.a.y - offset.y) * viewport.zoom + viewport.y;
      const x2 = (stroke.b.x - offset.x) * viewport.zoom + viewport.x;
      const y2 = (stroke.b.y - offset.y) * viewport.zoom + viewport.y;
      if (
        Math.max(x1, x2) < 0 ||
        Math.min(x1, x2) > size.width ||
        Math.max(y1, y2) < 0 ||
        Math.min(y1, y2) > size.height
      )
        continue;
      // Only enhance connections that become too short to read on screen.
      // Smoothly return to the original appearance between 3 and 10 pixels.
      const t = Math.max(
        0,
        Math.min(1, (10 - Math.hypot(x2 - x1, y2 - y1)) / 7),
      );
      const boost = Math.round(t * t * (3 - 2 * t) * 8) / 8;
      totalBoost += boost;
      visibleCount++;
      const key = `${stroke.color}:${alpha}:${boost}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { color: stroke.color, alpha, boost, path: new Path2D() };
        buckets.set(key, bucket);
      }
      bucket.path.moveTo(x1, y1);
      bucket.path.lineTo(x2, y2);
      if (boost > 0) {
        for (const [x, y] of [
          [x1, y1],
          [x2, y2],
        ]) {
          const key = `${x}:${y}:${stroke.color}`;
          const previous = endpoints.get(key);
          // Shared endpoints receive one highlight, never additive blooms.
          if (!previous || alpha * boost > previous.alpha * previous.boost)
            endpoints.set(key, {
              x: x!,
              y: y!,
              color: stroke.color,
              alpha,
              boost,
            });
        }
      }
    }
    context.lineCap = "butt";
    for (const { color, alpha, boost, path } of buckets.values()) {
      context.strokeStyle = color;
      context.globalAlpha = alpha * (0.12 + 0.14 * boost);
      context.lineWidth = 2.2 + 1.6 * boost;
      context.stroke(path);
      context.globalAlpha = alpha * (0.8 + 0.15 * boost);
      // Start at the blue line's width and settle into the red emphasis as
      // its color takes over, rather than introducing a thick second line.
      context.lineWidth = kind === "risk" ? 0.75 + (0.9 * alpha) / 0.95 : 0.75;
      context.stroke(path);
    }
    for (const { x, y, color, alpha, boost } of endpoints.values()) {
      context.fillStyle = color;
      context.globalAlpha = alpha * boost * 0.1;
      context.beginPath();
      context.arc(x, y, 2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha * boost * 0.65;
      context.beginPath();
      context.arc(x, y, 0.9, 0, Math.PI * 2);
      context.fill();
    }
    element.dataset.overviewBoost = String(
      totalBoost / Math.max(1, visibleCount),
    );
  }, [strokes, offset, size, viewport, kind]);
  return (
    <canvas
      ref={canvas}
      className={`transaction-canvas transaction-${kind}`}
      aria-hidden="true"
      data-path-count={strokes.length}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
});

export function TransactionOverlay({
  root,
  sector,
  entities,
  pulses = [],
  decisions = [],
}: {
  root: Sector;
  sector: Sector;
  entities: Entity[];
  pulses: GraphProps["pulses"];
  decisions: GraphProps["decisions"];
}) {
  const geometry = useMemo(() => {
    const points = sectorCloud(
      root,
      new Map(entities.map((e) => [e.id, e])),
    ).points;
    const byId = new Map(points.map((p) => [`${p.leaf}:${p.id}`, p]));
    const paths = new Map<
      string,
      { key: string; a: (typeof points)[number]; b: (typeof points)[number] }
    >();
    function visit(s: Sector) {
      for (const child of s.children) visit(child.sector);
      if (s.children.length) return;
      for (const p of s.group.payments) {
        const a = byId.get(`${s.group.id}:${p.accountId}`),
          b = byId.get(`${s.group.id}:${p.merchantId}`);
        if (a && b)
          paths.set(p.id, {
            key: `${s.group.id}:${p.accountId}:${p.merchantId}`,
            a,
            b,
          });
      }
    }
    visit(root);
    return paths;
  }, [root, entities]);
  const risks = useMemo(() => {
    const result = new Map<
      string,
      {
        path: NonNullable<ReturnType<typeof geometry.get>>;
        decision: string;
        eventIds: string[];
      }
    >();
    for (const event of decisions) {
      const path = geometry.get(event.eventId);
      if (!path || !["block", "review"].includes(event.decision)) continue;
      const previous = result.get(path.key);
      if (previous) {
        previous.eventIds.push(event.eventId);
        if (event.decision === "block") previous.decision = "block";
      } else {
        result.set(path.key, {
          path,
          decision: event.decision,
          eventIds: [event.eventId],
        });
      }
    }
    return [...result.values()];
  }, [geometry, decisions]);
  const offset = useMemo(
    () => sectorOffset(root, sector.group.id)!,
    [root, sector.group.id],
  );
  const progressByEvent = new Map(pulses.map((p) => [p.eventId, p.progress]));
  const riskStrokes = risks.map(({ path, decision, eventIds }) => ({
    a: path.a,
    b: path.b,
    color: decision === "block" ? "#ff5365" : "#ff8d7b",
    // A later payment must not erase an already visible flagged connection.
    strength:
      0.95 *
      eventIds.reduce(
        (opacity, id) =>
          Math.max(opacity, riskOpacity(progressByEvent.get(id))),
        0,
      ),
  }));
  const activePaths = new Map<
    string,
    { path: NonNullable<ReturnType<typeof geometry.get>>; progress: number }
  >();
  for (const pulse of pulses) {
    const path = geometry.get(pulse.eventId);
    if (!path) continue;
    const previous = activePaths.get(path.key);
    if (
      !previous ||
      firingOpacity(pulse.progress) > firingOpacity(previous.progress)
    )
      activePaths.set(path.key, { path, progress: pulse.progress });
  }
  // Keep total visual energy restrained in dense bursts without inventing or
  // sampling transactions. Repeated paths are already merged above.
  const totalIntensity = [...activePaths.values()].reduce(
    (sum, pulse) => sum + firingOpacity(pulse.progress),
    0,
  );
  const energy = Math.min(1, Math.sqrt(24 / Math.max(1, totalIntensity)));
  const currentStrokes = [...activePaths.values()].map(
    ({ path, progress }) => ({
      a: path.a,
      b: path.b,
      color: "#51e5ff",
      strength: firingOpacity(progress) * energy,
    }),
  );
  return (
    <>
      <CurrentCanvas strokes={riskStrokes} offset={offset} kind="risk" />
      <CurrentCanvas strokes={currentStrokes} offset={offset} kind="current" />
    </>
  );
}
