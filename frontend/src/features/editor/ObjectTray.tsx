import { useLayoutEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { kinds } from "../../domain/types";
import type { Entity, Position } from "../../domain/types";
import { ObjectGlyph } from "../graph/ObjectGlyph";
import { createElasticNodes } from "../graph/node-motion";
import type { ElasticPose } from "../graph/node-motion";
import styles from "../graph/Graph.module.css";

type Kind = Entity["type"];
type Props = {
  begin: () => boolean;
  place: (kind: Kind, point: Position, pose?: ElasticPose) => void;
  choose: (kind: Kind) => void;
};

export function ObjectTray(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const callbacks = useRef(props);
  const flow = useReactFlow();
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  useLayoutEffect(() => {
    const graph = root.current!;
    const homes = new Map<string, Position>();
    const positions = new Map<string, Position>();
    let pointer = { x: 0, y: 0 };
    const wrapper = (id: string) =>
      graph.querySelector<HTMLElement>(`[data-tray-id="${id}"]`)!;
    const move = (id: string, point: Position) => {
      positions.set(id, point);
      const element = wrapper(id);
      element.style.left = `${point.x - 50}px`;
      element.style.top = `${point.y - 50}px`;
      const bounds = surface.current!.getBoundingClientRect();
      const outside = Math.max(
        0,
        point.x - bounds.right,
        bounds.left - point.x,
        point.y - bounds.bottom,
        bounds.top - point.y,
      );
      const scale = 1 + (flow.getZoom() - 1) * Math.min(1, outside / 48);
      element.style.transform = `scale(${scale})`;
    };
    const motion = createElasticNodes({
      graph,
      worldPoint: (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        return pointer;
      },
      getPosition: (id) => positions.get(id)!,
      setPosition: move,
      updateGeometry: () => {},
      beginDrag: (id) => {
        if (!callbacks.current.begin()) return false;
        wrapper(id).dataset.lifted = "true";
        return true;
      },
      endDrag: (id, cancelled, moved) => {
        const element = wrapper(id);
        element.style.display = "none";
        const target = document.elementFromPoint(pointer.x, pointer.y);
        element.style.display = "";
        const point = positions.get(id)!;
        const accepted =
          !cancelled && moved && !!target?.closest(".react-flow");
        const pose = accepted ? motion.takePose(id) : undefined;
        move(id, homes.get(id)!);
        delete element.dataset.lifted;
        if (accepted)
          callbacks.current.place(
            id.slice(5) as Kind,
            flow.screenToFlowPosition(point),
            pose,
          );
      },
    });
    const layout = () => {
      motion.cancelDrag();
      const bounds = surface.current!.getBoundingClientRect();
      kinds.forEach((kind, index) => {
        const id = `tray-${kind}`;
        const home = {
          x: bounds.left + ((index % 2) + 0.5) * (bounds.width / 2),
          // Include the labels below each glyph when centering the two rows.
          y: bounds.top + bounds.height / 2 - 59 + Math.floor(index / 2) * 108,
        };
        homes.set(id, home);
        move(id, home);
      });
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(surface.current!);
    if (graph.parentElement) observer.observe(graph.parentElement);
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") motion.cancelDrag();
    };
    window.addEventListener("resize", layout);
    window.addEventListener("keydown", cancel);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("keydown", cancel);
      motion.destroy();
    };
  }, [flow]);
  return (
    <div ref={root} className="object-tray">
      <section
        ref={surface}
        id="object-drawer"
        className="tray-surface"
        aria-label="Add objects"
      >
        {kinds.map((kind) => (
          <div
            key={kind}
            data-tray-id={`tray-${kind}`}
            className={`${styles.object} tray-object node-${kind}`}
            role="button"
            tabIndex={0}
            aria-label={`Add ${kind}`}
            onClick={() => callbacks.current.choose(kind)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                callbacks.current.choose(kind);
              }
            }}
          >
            <ObjectGlyph
              node={{
                id: `tray-${kind}`,
                type: kind,
                name: kind[0]!.toUpperCase() + kind.slice(1),
              }}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
