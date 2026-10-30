import { expect, test } from "@playwright/test";
import { rankedQueue } from "../src/domain/reviewQueue";
import catalog from "../src/features/samples/catalog.json" with { type: "json" };

test("uploaded HTML and spreadsheet formulas remain text through preview and simulation", async ({
  page,
}) => {
  const html = '<img src=x onerror="document.body.dataset.csvXss=1">';
  const formula = '=HYPERLINK("https://example.invalid","click")';
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [
    [
      "payment_id",
      "timestamp",
      "amount",
      "account_id",
      "merchant_id",
      "account_name",
      "merchant_name",
    ],
    [
      "safe-1",
      "2026-01-01T12:00:00Z",
      "12.50",
      "account-a",
      "merchant-a",
      html,
      formula,
    ],
  ]
    .map((row) => row.map(quote).join(","))
    .join("\n");
  const response = await page.goto("/");
  expect(response!.headers()["content-security-policy"]).toContain(
    "script-src 'self';",
  );
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "untrusted-labels.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const prepared = page.waitForResponse("**/api/v1/simulations");
  await page
    .getByRole("button", { name: "Preview graph", exact: true })
    .click();
  const preview = page.getByRole("region", { name: "Import preview" });
  await preview
    .getByText("Objects in the imported graph", { exact: true })
    .click();
  await expect(
    preview.getByText(`account: ${html}`, { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText(`merchant: ${formula}`, { exact: true }),
  ).toBeVisible();
  await expect(preview.locator("img, script, a")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.body.dataset.csvXss),
  ).toBeUndefined();
  const scored = await prepared;
  expect(scored.ok()).toBe(true);
  expect(scored.headers()["cache-control"]).toBe("no-store");
  const run = await scored.json();
  expect(run.events).toHaveLength(1);
  expect(run.scenarioSnapshot.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "account", name: html }),
      expect.objectContaining({ type: "merchant", name: formula }),
    ]),
  );
  await page.getByRole("button", { name: "Build graph", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit scenario", exact: true }),
  ).toBeVisible();
  await expect(page.locator("img[src=x]")).toHaveCount(0);
});

test("largest sample finishes within the UI request timeout", async ({
  page,
}) => {
  const sample = catalog.samples.at(-1)!;
  await page.goto("/");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Start with a sample." });
  await library.getByRole("button", { name: new RegExp(sample.title) }).click();
  // Capture the large result before Chromium evicts it from its inspector cache.
  const captured =
    Promise.withResolvers<
      import("../src/api/generated").components["schemas"]["RunResult"]
    >();
  await page.route("**/api/v1/simulations", async (route) => {
    try {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      captured.resolve(await response.json());
      await route.fulfill({ response });
    } catch (error) {
      captured.reject(error);
    }
  });
  await library.getByRole("button", { name: "Open in workspace" }).click();
  await expect(library).toHaveCount(0, { timeout: 30000 });
  const started = Date.now();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const result = await captured.promise;
  expect(result.events).toHaveLength(sample.rows);
  expect(rankedQueue(result.events).suggestion.count).toBe(sample.alertCount);
  expect(Date.now() - started).toBeLessThan(30000);
  console.log(`${sample.rows} payments: ${Date.now() - started} ms`);
  await expect(
    page.getByRole("button", { name: "Edit scenario", exact: true }),
  ).toBeVisible();
});

test("public build opens a sample and imports a CSV through the real engine", async ({
  page,
}) => {
  const sample = catalog.samples[0]!;
  await page.goto("/");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Start with a sample." });
  await library.getByRole("button", { name: new RegExp(sample.title) }).click();
  const simulation = page.waitForResponse("**/api/v1/simulations");
  await library.getByRole("button", { name: "Open in workspace" }).click();
  await expect(library).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Payments ${sample.rows}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const response = await simulation;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.events).toHaveLength(sample.rows);
  expect(rankedQueue(result.events).suggestion.count).toBe(sample.alertCount);
  await page
    .getByRole("button", { name: "Edit scenario", exact: true })
    .click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles(`public/samples/${sample.file}`);
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  const imported = page.waitForResponse("**/api/v1/simulations");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const importedResponse = await imported;
  expect(importedResponse.ok()).toBe(true);
  expect((await importedResponse.json()).events).toHaveLength(sample.rows);
});
