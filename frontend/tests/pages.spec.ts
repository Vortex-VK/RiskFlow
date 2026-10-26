import { expect, test } from "@playwright/test";
import catalog from "../src/features/samples/catalog.json" with { type: "json" };

test("public content is readable without JavaScript, including recorded results", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5185/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every payment",
  );
  await page.getByRole("link", { name: "Guide", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create and connect objects" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sample results", exact: true }).click();
  await expect(page.getByRole("meter")).toHaveCount(6);
  await expect(
    page.getByRole("heading", { name: catalog.samples[0].title }),
  ).toBeVisible();
  await expect(page.locator(".sample").first()).toContainText("1 / 1");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await context.close();
});

test("static workspace loads presets, samples and CSVs without calling an absent API", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/workspace/");
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Live simulations are not connected yet",
  );
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  const preset = page.waitForResponse(
    "**/presets/templates/everyday-purchases.json",
  );
  await page.getByRole("button", { name: /Everyday purchases/i }).click();
  expect((await preset).ok()).toBe(true);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("unavailable");
  const sample = catalog.samples[0];
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Start with a sample." });
  await library.getByRole("button", { name: new RegExp(sample.title) }).click();
  await library.getByRole("button", { name: "Open in workspace" }).click();
  await expect(library).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Payments ${sample.rows}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles(`public/samples/ibm/${sample.file}`);
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(
    page.getByRole("button", { name: `Payments ${sample.rows}`, exact: true }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("the disconnected tutorial finishes at Samples after creating a payment", async ({
  page,
}) => {
  await page.goto("/workspace/");
  await page.getByRole("button", { name: "Show tutorial" }).click();
  const tour = page.locator(".tutorial-tour");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  const place = async (kind: string, x: number, y: number) => {
    const box = (await page
      .locator(`[data-tray-id="tray-${kind}"]`)
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.up();
  };
  await place("account", 600, 400);
  await page.getByRole("button", { name: "Create starter context" }).click();
  if (!(await page.locator("#object-drawer").isVisible()))
    await page.getByRole("button", { name: "Objects", exact: true }).click();
  await place("merchant", 950, 450);
  await expect(tour).toHaveAttribute("data-phase", "connect");
  const account = (await page
    .locator(".react-flow__node:has(.node-account)")
    .boundingBox())!;
  const merchant = (await page
    .locator(".react-flow__node:has(.node-merchant)")
    .boundingBox())!;
  await page.mouse.move(
    account.x + account.width / 2,
    account.y + account.height / 2,
  );
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    merchant.x + merchant.width / 2,
    merchant.y + merchant.height / 2,
    { steps: 8 },
  );
  await page.mouse.up({ button: "right" });
  await expect(tour).toHaveAttribute("data-phase", "payment");
  await page.getByLabel(/Amount/).fill("50.00");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(tour).toHaveAttribute("data-phase", "samples");
  await expect(tour.locator(".kicker")).toContainText("7 of 7");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await expect(tour).toHaveCount(0);
});
