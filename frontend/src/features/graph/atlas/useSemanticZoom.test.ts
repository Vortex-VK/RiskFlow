import { describe, expect, it } from "vitest";
import { zoomDestination } from "./useSemanticZoom";
import type { Sector } from "./model";
const leaf = {
  group: { id: "all/0" },
  territory: [
    { x: -50, y: -50 },
    { x: 50, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
  ],
  children: [],
} as unknown as Sector;
const sector = {
  group: { id: "all" },
  children: [{ sector: leaf, center: { x: 100, y: 100 }, scale: 1 }],
} as unknown as Sector;
const input = {
  sector,
  parent: null,
  point: { x: 100, y: 100 },
  zoom: 1.8,
  direction: 1,
  travel: Math.log(2),
  inputs: 3,
  fittedZoom: (s: Sector) => (s === leaf ? 2 : 1),
};
describe("intentional semantic zoom", () => {
  it("requires multiple inputs, enough zoom travel and a sector beneath the focal point", () => {
    expect(zoomDestination(input)).toBe("all/0");
    expect(
      zoomDestination({ ...input, inputs: 1, travel: 3, zoom: 20 }),
    ).toBeNull();
    expect(zoomDestination({ ...input, travel: 0.1 })).toBeNull();
    expect(zoomDestination({ ...input, zoom: 1.2 })).toBeNull();
    expect(zoomDestination({ ...input, point: { x: 900, y: 900 } })).toBeNull();
  });
  it("allows returning from leaf detail and keeps single-scroll protection with an earlier exit", () => {
    expect(
      zoomDestination({
        ...input,
        sector: leaf,
        parent: "all",
        direction: -1,
        zoom: 1.8,
      }),
    ).toBe("all");
    expect(
      zoomDestination({
        ...input,
        sector: leaf,
        parent: "all",
        direction: -1,
        zoom: 1.95,
      }),
    ).toBeNull();
    expect(zoomDestination({ ...input, direction: -1, zoom: 0.1 })).toBeNull();
  });
  it("never subdivides a final leaf when magnifying it", () => {
    expect(zoomDestination({ ...input, sector: leaf, zoom: 20 })).toBeNull();
  });
});
