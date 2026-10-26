import type { Position } from "../../domain/types";
import type { Contact } from "./collisions";
export type ElasticPose = { readonly elasticPose: unique symbol };
export function jellyRestPoints(radius: number, corner: number): Position[];
export function jellyPath(points: Position[]): string;
export function createElasticNodes(options: {
  graph: HTMLElement;
  getPosition: (id: string) => Position;
  setPosition: (id: string, position: Position) => void;
  updateGeometry: () => void;
  worldPoint: (event: PointerEvent) => Position;
  beginDrag: (id: string) => boolean;
  endDrag: (id: string, cancelled: boolean, moved: boolean) => void;
}): {
  cancelDrag: () => void;
  contact: (contacts: readonly Contact[]) => void;
  takePose: (id: string) => ElasticPose | undefined;
  adoptPose: (id: string, pose: ElasticPose) => void;
  destroy: () => void;
};
