import { useEffect, useRef } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import type { Position } from "../../../domain/types";
import type { Sector } from "./model";
import { insideTerritory } from "./layout";

export function zoomDestination({
  sector,
  parent,
  point,
  zoom,
  direction,
  travel,
  inputs,
  fittedZoom,
}: {
  sector: Sector;
  parent: string | null;
  point: Position;
  zoom: number;
  direction: number;
  travel: number;
  inputs: number;
  fittedZoom: (sector: Sector) => number;
}): string | null {
  if (inputs < 2 || travel < Math.log(1.35)) return null;
  if (direction < 0)
    return parent && zoom < fittedZoom(sector) * 0.92 ? parent : null;
  const child = sector.children.find((c) =>
    insideTerritory(
      {
        x: (point.x - c.center.x) / c.scale,
        y: (point.y - c.center.y) / c.scale,
      },
      c.sector.territory,
    ),
  );
  return child && zoom * child.scale >= fittedZoom(child.sector) * 0.85
    ? child.sector.group.id
    : null;
}
export function useSemanticZoom(config: {
  sector: Sector;
  parent: string | null;
  busy: boolean;
  fittedZoom: (sector: Sector) => number;
  navigate: (id: string) => void;
}) {
  const latest = useRef(config);
  latest.current = config;
  const flow = useReactFlow();
  const store = useStoreApi();
  const group = config.sector.group.id;
  const busy = config.busy;
  useEffect(() => {
    if (busy) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let direction = 0,
      travel = 0,
      inputs = 0,
      intentAt = 0;
    let anchor: Position | null = null;
    let pending = false;
    const touches = new Map<number, Position>();
    let pinchDistance = 0;
    const readyAt = performance.now() + 250;
    const reset = () => {
      clearTimeout(timer);
      direction = 0;
      travel = 0;
      inputs = 0;
      intentAt = 0;
    };
    const intent = (nextDirection: number, point: Position | null) => {
      if (pending || latest.current.busy || performance.now() < readyAt) return;
      if (direction !== nextDirection || performance.now() - intentAt > 4000)
        reset();
      direction = nextDirection;
      inputs++;
      intentAt = performance.now();
      anchor = point;
    };
    const wheel = (event: WheelEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".hierarchy-stage .react-flow") ||
        !event.deltaY
      )
        return;
      intent(event.deltaY < 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      const label = button?.getAttribute("aria-label");
      if (label === "Zoom in" || label === "Zoom out")
        intent(label === "Zoom in" ? 1 : -1, null);
      else if (button) reset();
    };
    const down = (event: PointerEvent) => {
      const button =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (
        !["Zoom in", "Zoom out"].includes(
          button?.getAttribute("aria-label") || "",
        )
      )
        reset();
      if (
        event.pointerType === "touch" &&
        event.target instanceof Element &&
        event.target.closest(".hierarchy-stage .react-flow")
      ) {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        }
      }
    };
    const move = (event: PointerEvent) => {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size !== 2) return;
      const [a, b] = [...touches.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (!pinchDistance || Math.abs(distance - pinchDistance) < 0.5) return;
      intent(distance > pinchDistance ? 1 : -1, {
        x: (a!.x + b!.x) / 2,
        y: (a!.y + b!.y) / 2,
      });
      pinchDistance = distance;
    };
    const up = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      pinchDistance = 0;
    };
    const check = () => {
      const c = latest.current;
      if (pending || c.busy || c.sector.group.id !== group) return;
      const viewport = flow.getViewport();
      const point = flow.screenToFlowPosition(
        anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      );
      const id = zoomDestination({
        sector: c.sector,
        parent: c.parent,
        point,
        zoom: viewport.zoom,
        direction,
        travel,
        inputs,
        fittedZoom: c.fittedZoom,
      });
      if (id) {
        pending = true;
        reset();
        c.navigate(id);
      }
    };
    const unsubscribe = store.subscribe((state, previous) => {
      const zoom = state.transform[2],
        before = previous.transform[2];
      if (
        zoom === before ||
        !direction ||
        pending ||
        performance.now() - intentAt > 1200
      )
        return;
      const change = Math.log(zoom / before);
      if (Math.sign(change) !== direction) {
        reset();
        return;
      }
      travel += Math.abs(change);
      clearTimeout(timer);
      timer = setTimeout(check, 120);
    });
    window.addEventListener("wheel", wheel, { capture: true, passive: true });
    window.addEventListener("click", click, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, [group, busy, flow, store]);
}
