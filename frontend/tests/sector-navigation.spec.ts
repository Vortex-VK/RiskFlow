import {
  addIndependentActivity,
  openExampleWorkspace,
} from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Document } from "../src/domain/types";

async function fixture(page: import("@playwright/test").Page) {
  const document = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  const payments = document.scenario.payments;
  document.scenario.payments = Array.from({ length: 48 }, (_, i) => ({
    ...payments[i % payments.length]!,
    id: `sector-${i}`,
  }));
  document.scenario.groundTruth = {};
  addIndependentActivity(document);
  await page.route("**/api/v1/templates/shared-device-cluster", (r) =>
    r.fulfill({ json: document }),
  );
  await openExampleWorkspace(page);
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
}

test("a new object belongs to its creation sector across navigation and undo/redo", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  const leaves = page.locator(
    '.transaction-sector[data-leaf="true"] .territory-hit',
  );
  const first = await leaves.nth(0).getAttribute("data-sector");
  const second = await page
    .locator('.transaction-sector[data-leaf="false"] .territory-hit')
    .first()
    .getAttribute("data-sector");
  const enter = async (id: string) => {
    await page
      .locator(`.transaction-sector:has([data-sector="${id}"])`)
      .press("Enter");
    await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
      "data-transitioning",
      "false",
    );
    while (
      await page.locator('.hierarchy-stage[data-detail="false"]').count()
    ) {
      await page.locator(".transaction-sector").first().press("Enter");
      await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
        "data-transitioning",
        "false",
      );
    }
  };
  const overview = async () => {
    await page
      .getByRole("navigation", { name: "Transaction groups" })
      .getByRole("button", { name: "All payments", exact: true })
      .press("Enter");
    await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
      "data-transitioning",
      "false",
    );
  };
  await enter(first!);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page
    .getByRole("button", { name: "Add merchant", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Place at center" }).click();
  const added = page
    .locator(".react-flow__node")
    .filter({ hasText: "New merchant" });
  await expect(added).toHaveCount(1);
  const id = await added.getAttribute("data-id");
  const transform = await added.evaluate(
    (node) => (node as HTMLElement).style.transform,
  );
  await page.keyboard.press("Escape");
  await overview();
  await enter(second!);
  const object = page.locator(`.react-flow__node[data-id="${id}"]`);
  await expect(object).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  await expect(object).toHaveCount(0);
  await overview();
  await enter(first!);
  await expect(object).toHaveCount(1);
  expect(
    await object.evaluate((node) => (node as HTMLElement).style.transform),
  ).toBe(transform);
});

test("points arrive at the exact final object centers and the camera travels in both directions", async ({
  page,
}) => {
  await fixture(page);
  await page.evaluate(() => {
    const trace = {
      points: [] as { x: number; y: number }[],
      zooms: [] as number[],
      active: true,
    };
    (window as unknown as { atlasArrival: typeof trace }).atlasArrival = trace;
    const arc = CanvasRenderingContext2D.prototype.arc;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("atlas-cloud")) trace.points = [];
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (this.canvas.classList.contains("atlas-cloud"))
        trace.points.push({ x: args[0], y: args[1] });
      return arc.apply(this, args);
    };
    const tick = () => {
      if (!trace.active) return;
      const v = document.querySelector(".react-flow__viewport");
      if (v) trace.zooms.push(new DOMMatrix(getComputedStyle(v).transform).a);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page
    .locator('.transaction-sector[data-leaf="true"]')
    .first()
    .press("Enter");
  await expect(page.locator(".node-hit").first()).toBeVisible();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const arrival = await page.evaluate(() => {
    const trace = (
      window as unknown as {
        atlasArrival: {
          points: { x: number; y: number }[];
          zooms: number[];
          active: boolean;
        };
      }
    ).atlasArrival;
    const distances = [...document.querySelectorAll(".react-flow__node")].map(
      (n) => {
        const b = n.getBoundingClientRect();
        return Math.min(
          ...trace.points.map((p) =>
            Math.hypot(p.x - (b.x + b.width / 2), p.y - (b.y + b.height / 2)),
          ),
        );
      },
    );
    return { distances, zooms: trace.zooms };
  });
  expect(arrival.distances.length).toBeGreaterThan(0);
  expect(Math.max(...arrival.distances)).toBeLessThan(4);
  expect(new Set(arrival.zooms.map((z) => z.toFixed(4))).size).toBeGreaterThan(
    8,
  );
  await page.getByRole("button", { name: "All payments", exact: true }).click();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const zooms = await page.evaluate(() => {
    const t = (
      window as unknown as {
        atlasArrival: { zooms: number[]; active: boolean };
      }
    ).atlasArrival;
    t.active = false;
    return t.zooms;
  });
  expect(zooms.at(-1)).toBeCloseTo(zooms[0]!, 3);
});

test("reduced motion reaches detail without camera or object animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  await page.evaluate(() => {
    const trace = { zooms: [] as number[], active: true };
    (
      window as unknown as { reducedMotionTrace: typeof trace }
    ).reducedMotionTrace = trace;
    const tick = () => {
      if (!trace.active) return;
      const viewport = document.querySelector(".react-flow__viewport")!;
      trace.zooms.push(new DOMMatrix(getComputedStyle(viewport).transform).a);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page
    .locator('.transaction-sector[data-leaf="true"]')
    .first()
    .press("Enter");
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const body = page.locator(".node-body").first();
  await expect(body).toBeVisible();
  const rest = await body.getAttribute("d");
  await page.waitForTimeout(300);
  await expect(body).toHaveAttribute("d", rest!);
  const zooms = await page.evaluate(() => {
    const trace = (
      window as unknown as {
        reducedMotionTrace: { zooms: number[]; active: boolean };
      }
    ).reducedMotionTrace;
    trace.active = false;
    return trace.zooms;
  });
  expect(zooms.length).toBeGreaterThan(5);
  expect(new Set(zooms.map((z) => z.toFixed(4))).size).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "All payments", exact: true }).click();
  await expect(page.locator(".atlas-cloud")).toHaveCount(1);
});
