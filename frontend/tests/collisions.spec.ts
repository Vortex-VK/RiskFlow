import { openExampleWorkspace, setPlaybackSpeed } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Document } from "../src/domain/types";

const node = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const center = async (page: Page, id: string) => {
  await expect(node(page, id)).toBeVisible();
  const box = (await node(page, id).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const positions = (page: Page) =>
  page.locator(".react-flow__node").evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return [
          node.getAttribute("data-id"),
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        ];
      }),
    ),
  );
const dragInto = async (page: Page, source: string, target: string) => {
  const start = await center(page, source),
    end = await center(page, target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 20 });
  return end;
};

test.beforeEach(async ({ page }) => {
  const fixture = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  fixture.scenario.nodes.forEach((n, i) => {
    fixture.view.positions[n.id] = { x: 100 + i * 70, y: 200 };
  });
  Object.assign(fixture.view.positions, {
    "account-a": { x: 350, y: 450 },
    "account-b": { x: 450, y: 450 },
    "account-c": { x: 530, y: 450 },
  });
  await page.route("**/api/v1/templates/shared-device-cluster", (route) =>
    route.fulfill({ json: fixture }),
  );
  await openExampleWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
});

test("dragging pushes a chain, keeps connections mounted and commits one undoable layout change", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const original = await positions(page);
  const edge = await page.locator(".react-flow__edge").first().elementHandle();
  const endpoint = await dragInto(page, "account-a", "account-b");
  const held = await center(page, "account-a");
  expect(Math.abs(held.x - endpoint.x)).toBeLessThan(1);
  expect(Math.abs(held.y - endpoint.y)).toBeLessThan(1);
  expect((await center(page, "account-b")).x).toBeGreaterThan(
    original["account-b"].x + 50,
  );
  expect((await center(page, "account-c")).x).toBeGreaterThan(
    original["account-c"].x + 30,
  );
  expect(await edge!.evaluate((e) => e.isConnected)).toBe(true);
  await expect(page.locator(".react-flow__edge")).toHaveCount(21);
  await page.screenshot({ path: "../docs/screenshots/collision-push.png" });
  await page.mouse.up();
  const pushed = await positions(page);
  const b = await center(page, "account-b");
  await page.mouse.click(b.x, b.y);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Blair Chen",
  );
  await button(page, "Close details").click();
  await button(page, "Undo").click();
  expect(await positions(page)).toEqual(original);
  await expect(button(page, "Undo")).toBeDisabled();
  await button(page, "Redo").click();
  expect(await positions(page)).toEqual(pushed);
  await button(page, "Simulate").click();
  await button(page, "Inspect payments").click();
  await button(page, "Inspect H10").click();
  await expect(page.locator(".decision")).toContainText("no alert");
  expect(errors).toEqual([]);
});

test("Escape and lost pointer capture restore every pushed object without adding history", async ({
  page,
}) => {
  const original = await positions(page);
  for (const cancel of ["escape", "capture"]) {
    await dragInto(page, "account-a", "account-b");
    expect(await positions(page)).not.toEqual(original);
    if (cancel === "escape") await page.keyboard.press("Escape");
    else
      await node(page, "account-a")
        .locator("[data-node]")
        .dispatchEvent("lostpointercapture");
    await page.mouse.up();
    expect(await positions(page)).toEqual(original);
    await expect(button(page, "Undo")).toBeDisabled();
  }
});

test("keyboard pushing works with motion disabled and transparent wrappers do not steal clicks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const original = await center(page, "account-b");
  await node(page, "account-a").focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
  expect((await center(page, "account-b")).x).toBeGreaterThan(original.x + 30);
  const a = await center(page, "account-a");
  const transparentCorner = { x: a.x + 49, y: a.y + 49 };
  expect(
    await page.evaluate(
      ({ x, y }) =>
        !!document.elementFromPoint(x, y)?.closest(".react-flow__node"),
      transparentCorner,
    ),
  ).toBe(false);
  await page.mouse.click(a.x, a.y);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
});

test("running, paused and completed snapshots push locally and leave editor positions unchanged", async ({
  page,
}) => {
  const original = await positions(page);
  await button(page, "Simulate").click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  for (const state of ["running", "paused", "complete"]) {
    if (state === "paused") await button(page, "Pause").click();
    if (state === "complete") {
      await setPlaybackSpeed(page, 10);
      await button(page, "Play").click();
      await expect(page.getByRole("status")).toContainText("Run complete");
    }
    const before = await center(page, "account-b");
    await dragInto(page, "account-a", "account-b");
    await page.mouse.up();
    expect((await center(page, "account-b")).x).toBeGreaterThan(before.x + 30);
    await expect(page.locator(".react-flow__edge")).toHaveCount(21);
  }
  const snapshot = await positions(page);
  await dragInto(page, "account-a", "account-b");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await positions(page)).toEqual(snapshot);
  await button(page, "Edit scenario").click();
  expect(await positions(page)).toEqual(original);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("dropping a tray object onto an existing object separates them and undo restores both", async ({
  page,
}) => {
  const original = await positions(page);
  await button(page, "Objects").click();
  const source = page.locator('[data-tray-id="tray-account"]');
  const box = (await source.boundingBox())!;
  const target = await center(page, "account-a");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__node")).toHaveCount(16);
  const created = (await page
    .locator(".react-flow__node")
    .last()
    .boundingBox())!;
  expect(Math.abs(created.x + created.width / 2 - target.x)).toBeLessThan(1);
  expect(Math.abs(created.y + created.height / 2 - target.y)).toBeLessThan(1);
  const moved = await center(page, "account-a");
  expect(Math.hypot(moved.x - target.x, moved.y - target.y)).toBeGreaterThan(
    65,
  );
  await button(page, "Undo").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  expect(await positions(page)).toEqual(original);
});
