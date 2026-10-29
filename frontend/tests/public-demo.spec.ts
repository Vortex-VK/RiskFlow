import { expect, test } from "@playwright/test";
import catalog from "../src/features/samples/catalog.json" with { type: "json" };

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
  expect(
    result.events.filter(
      (event: { model?: { alert: boolean } }) => event.model?.alert,
    ),
  ).toHaveLength(sample.alertCount);
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
  expect(
    result.events.filter(
      (event: { model?: { alert: boolean } }) => event.model?.alert,
    ),
  ).toHaveLength(sample.alertCount);
  await page
    .getByRole("button", { name: "Edit scenario", exact: true })
    .click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles(`public/samples/ibm/${sample.file}`);
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  const imported = page.waitForResponse("**/api/v1/simulations");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const importedResponse = await imported;
  expect(importedResponse.ok()).toBe(true);
  expect((await importedResponse.json()).events).toHaveLength(sample.rows);
});
