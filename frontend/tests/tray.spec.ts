import { openExampleWorkspace } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const source = (page: Page, kind = "account") =>
  page.locator(`[data-tray-id="tray-${kind}"]`);
const center = async (page: Page, kind = "account") => {
  const box = (await source(page, kind).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
});

test("lifted jelly is the same tray element, follows the grip, settles on canvas and replenishes", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Workspace", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check scenario" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  const original = await source(page).elementHandle();
  const home = await center(page);
  const rest = await source(page).locator(".node-body").getAttribute("d");
  await page.mouse.move(home.x + 16, home.y - 4);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(home.x + 16 + i * 55, home.y - 4 + i * 20);
    await page.waitForTimeout(18);
  }
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  expect(await center(page)).not.toEqual(home);
  expect(await source(page).locator(".node-body").getAttribute("d")).not.toBe(
    rest,
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  const lifted = await center(page);
  await page.screenshot({
    path: "../docs/screenshots/tray-lifted.png",
    animations: "disabled",
  });
  await page.mouse.up();
  await expect(page.locator(".react-flow__node")).toHaveCount(16);
  await expect(page.getByRole("region", { name: "Add objects" })).toBeVisible();
  expect((await center(page)).x).toBeCloseTo(home.x, 2);
  expect((await center(page)).y).toBeCloseTo(home.y, 2);
  await expect(page.locator("[data-tray-id]")).toHaveCount(4);
  const placed = page
    .locator(".react-flow__node")
    .filter({ has: page.locator("text", { hasText: "New account" }) });
  const created = page.locator(".react-flow__node").last();
  const box = (await created.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - lifted.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - lifted.y)).toBeLessThan(2);
  await expect(created.locator(".node-body")).toBeVisible();
  await expect(placed).toHaveCount(1);
  await expect(created.locator(".node-body")).not.toHaveAttribute("d", rest!);
  await page.mouse.move(1100, 650);
  await expect
    .poll(
      async () =>
        created.locator(".node-body").evaluate((body) => {
          const bounds = (body as SVGGraphicsElement).getBBox();
          return Math.max(
            Math.abs(bounds.width - 64),
            Math.abs(bounds.height - 64),
          );
        }),
      { timeout: 6000 },
    )
    .toBeLessThan(5.5);
  await expect(created.locator(".node-material")).toHaveAttribute(
    "transform",
    "matrix(1.00000 0.00000 0.00000 1.00000 0.000 0.000)",
    { timeout: 6000 },
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(16);
});

test("cancelled and off-canvas drops return the object without creating graph history", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  const home = await center(page, "device");
  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  const button = (await page
    .getByRole("button", { name: "Import CSV", exact: true })
    .boundingBox())!;
  await page.mouse.move(button.x + 20, button.y + 20, { steps: 8 });
  await page.mouse.up();
  expect((await center(page, "device")).x).toBeCloseTo(home.x, 2);
  expect((await center(page, "device")).y).toBeCloseTo(home.y, 2);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  await page.mouse.move(600, 450, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  expect((await center(page, "device")).x).toBeCloseTo(home.x, 2);
  expect((await center(page, "device")).y).toBeCloseTo(home.y, 2);
});

test("touch placement works at a changed canvas zoom with reduced motion", async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Native touch drag injection requires Chromium CDP.",
  );
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 900, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await openExampleWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, -100);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  const home = await center(page, "merchant");
  const rest = await source(page, "merchant")
    .locator(".node-body")
    .getAttribute("d");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: home.x, y: home.y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: home.x + ((600 - home.x) * i) / 8,
          y: home.y + ((420 - home.y) * i) / 8,
        },
      ],
    });
  expect(
    await source(page, "merchant").locator(".node-body").getAttribute("d"),
  ).toBe(rest);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(16);
  const placed = (await page
    .locator(".react-flow__node")
    .last()
    .boundingBox())!;
  expect(Math.abs(placed.x + placed.width / 2 - 600)).toBeLessThan(2);
  expect(Math.abs(placed.y + placed.height / 2 - 420)).toBeLessThan(2);
  expect((await center(page, "merchant")).x).toBeCloseTo(home.x, 2);
  expect((await center(page, "merchant")).y).toBeCloseTo(home.y, 2);
  await context.close();
});

test("CSV panel is opaque and the close icon is geometrically centered in dark mode", async ({
  page,
}) => {
  for (const theme of ["dark"]) {
    if (theme === "dark")
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "CSV import" });
    await expect(panel).toHaveCSS(
      "background-color",
      theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 24, 24)",
    );
    await expect(panel).toHaveCSS("opacity", "1");
    const close = page.getByRole("button", { name: "Close CSV import" });
    const button = (await close.boundingBox())!;
    const icon = (await close.locator("svg").boundingBox())!;
    expect(
      Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2),
    ).toBeLessThan(0.1);
    expect(
      Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2),
    ).toBeLessThan(0.1);
    await page.screenshot({
      path: `../docs/screenshots/csv-solid-${theme}.png`,
      animations: "disabled",
    });
    await close.click();
    await expect(panel).toHaveCount(0);
  }
});
