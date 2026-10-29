import { openExampleWorkspace, syntheticModelCsv } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { Document } from "../src/domain/types";

test("continuous sector map: import, fixed canvas, smooth camera, detail, themes and full simulation", async ({
  page,
  browserName,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "synthetic-model-inputs.csv",
    mimeType: "text/csv",
    buffer: await syntheticModelCsv(
      "../fixtures/imports/transactions-synthetic.csv",
    ),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  const stage = page.locator(".hierarchy-stage");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await expect(page.locator(".transaction-sector")).toHaveCount(5);
  await expect(page.locator(".atlas-cloud")).toHaveAttribute(
    "data-cloud-payments",
    "3434",
  );
  expect(
    Number(
      await page
        .locator(".atlas-cloud")
        .getAttribute("data-preview-connections"),
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator(".cluster-boundary")).toHaveCount(0);
  await page.screenshot({ path: "../docs/screenshots/atlas-overview.png" });
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await page.screenshot({ path: "../docs/screenshots/atlas-dark.png" });
  await page.evaluate(() => {
    const canvas = document.querySelector(".atlas-cloud")!;
    const trace = {
      canvas,
      frames: [] as number[],
      zooms: [] as number[],
      mounted: true,
      active: true,
    };
    (window as unknown as { atlasTrace: typeof trace }).atlasTrace = trace;
    let last = performance.now();
    const tick = (now: number) => {
      if (!trace.active) return;
      trace.frames.push(now - last);
      last = now;
      trace.mounted &&= document.querySelector(".atlas-cloud") === canvas;
      const viewport = document.querySelector(".react-flow__viewport")!;
      trace.zooms.push(new DOMMatrix(getComputedStyle(viewport).transform).a);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page
    .locator('.transaction-sector[data-leaf="false"]')
    .first()
    .press("Enter");
  await expect(page.getByTestId("cluster-overview")).not.toHaveAttribute(
    "data-group",
    "all",
  );
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  const trace = await page.evaluate(() => {
    const trace = (
      window as unknown as {
        atlasTrace: {
          frames: number[];
          zooms: number[];
          mounted: boolean;
          active: boolean;
        };
      }
    ).atlasTrace;
    trace.active = false;
    return { frames: trace.frames, zooms: trace.zooms, mounted: trace.mounted };
  });
  expect(trace.mounted).toBe(true);
  expect(new Set(trace.zooms.map((z) => z.toFixed(4))).size).toBeGreaterThan(
    10,
  );
  await page.screenshot({ path: "../docs/screenshots/atlas-middle.png" });
  let clicks = 0;
  while (await page.locator(".transaction-sector").count()) {
    if (
      (await page.locator('.transaction-sector[data-leaf="false"]').count()) ===
      0
    ) {
      await expect(page.locator(".atlas-cloud")).toHaveAttribute(
        "data-preview-connections",
        "0",
      );
      expect(
        await page.locator(".connection-target").count(),
      ).toBeLessThanOrEqual(await page.locator(".transaction-sector").count());
      await page.screenshot({
        path: "../docs/screenshots/atlas-before-detail.png",
      });
    }
    expect(++clicks).toBeLessThan(10);
    await page.locator(".transaction-sector").first().press("Enter");
    await expect(stage).toHaveAttribute("data-transitioning", "false");
  }
  await expect(
    page.getByRole("navigation", { name: "Transaction groups" }),
  ).toContainText("interactive detail");
  expect(await page.locator(".node-hit").count()).toBeGreaterThan(0);
  expect(await page.locator(".react-flow__edge").count()).toBeGreaterThan(0);
  await page.screenshot({ path: "../docs/screenshots/atlas-detail.png" });
  await page.getByRole("button", { name: "All payments", exact: true }).click();
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await expect(page.locator(".transaction-sector")).toHaveCount(5);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/simulations") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const run = await (await response).json();
  expect(run.events).toHaveLength(3434);
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  const last = run.events.at(-1);
  await page.getByRole("textbox", { name: "Find payment" }).fill(last.eventId);
  await page
    .getByRole("button", { name: `Inspect ${last.eventId}`, exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Transaction groups" }),
  ).toContainText("interactive detail");
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toContainText("Merchant history");
  expect(errors).toEqual([]);
  const frames = trace.frames.sort((a, b) => a - b);
  await writeFile(
    `../docs/screenshots/atlas-performance-${browserName}.json`,
    JSON.stringify(
      {
        payments: 3434,
        cameraSamples: trace.zooms.length,
        uniqueZooms: new Set(trace.zooms).size,
        canvasStayedMounted: trace.mounted,
        p95: frames[Math.floor(frames.length * 0.95)],
        max: frames.at(-1),
      },
      null,
      2,
    ),
  );
});

test("10,000-payment full point map remains one canvas", async ({
  page,
  browserName,
}) => {
  test.setTimeout(90000);
  const document = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  const merchant = document.scenario.nodes.find((n) => n.type === "merchant")!;
  while (document.scenario.nodes.length < 500) {
    const id = `merchant-${document.scenario.nodes.length}`;
    document.scenario.nodes.push({ ...merchant, id, name: id });
    document.view.positions[id] = { x: 500, y: 400 };
  }
  const merchants = document.scenario.nodes.filter(
    (n) => n.type === "merchant",
  );
  const payment = document.scenario.payments[0]!;
  document.scenario.payments = Array.from({ length: 10000 }, (_, i) => ({
    ...payment,
    id: `P${String(i).padStart(5, "0")}`,
    merchantId: merchants[i % merchants.length]!.id,
  }));
  document.scenario.groundTruth = {};
  await page.route("**/api/v1/templates/shared-device-cluster", (route) =>
    route.fulfill({ json: document }),
  );
  await openExampleWorkspace(page);
  await expect(page.locator(".atlas-cloud")).toHaveAttribute(
    "data-cloud-payments",
    "10000",
  );
  expect(
    Number(
      await page.locator(".atlas-cloud").getAttribute("data-cloud-points"),
    ),
  ).toBeGreaterThan(1000);
  await expect(page.locator(".node-hit")).toHaveCount(0);
  await page.evaluate(() => {
    const trace = { frames: [] as number[], active: true };
    (window as unknown as { largeAtlasTrace: typeof trace }).largeAtlasTrace =
      trace;
    let last = performance.now();
    const tick = (now: number) => {
      if (!trace.active) return;
      trace.frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page
    .locator('.transaction-sector[data-leaf="false"]')
    .first()
    .press("Enter");
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await expect(page.locator(".atlas-cloud")).toHaveCount(1);
  await page.getByRole("button", { name: "All payments", exact: true }).click();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const frames = await page.evaluate(() => {
    const trace = (
      window as unknown as {
        largeAtlasTrace: { frames: number[]; active: boolean };
      }
    ).largeAtlasTrace;
    trace.active = false;
    return trace.frames.sort((a, b) => a - b);
  });
  expect(frames.length).toBeGreaterThan(20);
  const p95 = frames[Math.floor(frames.length * 0.95)]!;
  expect(p95).toBeLessThan(50);
  await writeFile(
    `../docs/screenshots/atlas-large-performance-${browserName}.json`,
    JSON.stringify(
      {
        payments: 10000,
        objects: 500,
        p95,
        max: frames.at(-1),
        samples: frames.length,
      },
      null,
      2,
    ),
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Inspect payments", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Find payment" }).fill("P09999");
  await page
    .getByRole("button", { name: "Inspect P09999", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Transaction groups" }),
  ).toContainText("interactive detail");
});
