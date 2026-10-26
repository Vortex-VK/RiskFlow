import type { Entity } from "../../domain/types";

type Shape = Pick<Entity, "id" | "type">;

export const radius = (node: Shape) =>
  node.id === "device-shared"
    ? 27
    : { account: 32, merchant: 24, device: 19, location: 12 }[node.type];

export const cornerRadius = (node: Shape) =>
  node.type === "device"
    ? node.id === "device-shared"
      ? 13
      : 8
    : radius(node);

export const collisionRadius = (node: Shape) =>
  radius(node) + (Math.SQRT2 - 1) * (radius(node) - cornerRadius(node));
