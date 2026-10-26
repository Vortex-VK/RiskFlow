import type { Viewport } from "@xyflow/react";
import type { Position } from "../../domain/types";

type GraphView = {
  viewport: Viewport;
  path: string[];
  layouts: Map<string, Record<string, Position>>;
};
// Transient UI state shared by editor and replay, never written to run data.
const views = new Map<string, GraphView>();
export const readGraphView = (key: string) => views.get(key);
export function rememberGraphView(key: string, view: GraphView) {
  views.delete(key);
  views.set(key, view);
  if (views.size > 8) views.delete(views.keys().next().value!);
}
