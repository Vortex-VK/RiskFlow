import { setReviewCapacity } from "./workspace-helpers";
import { uploadQueueRun } from "./workspace-helpers";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("CSV preparation starts before Simulate and its result powers playback and explanations", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let submissions = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/simulations")) submissions++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/samples/ibm/many-accounts.csv");
  const prepared = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/simulations"),
  );
  const preparationStart = Date.now();
  await page.getByRole("button", { name: "Preview graph" }).click();
  const response = await prepared;
  expect(response.ok()).toBe(true);
  const run = uploadQueueRun(await response.json(), 10);
  const preparationMs = Date.now() - preparationStart;
  expect(run.events).toHaveLength(5000);
  expect(submissions).toBe(1);
  await expect(
    page.getByRole("region", { name: "Run assessment summary" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/, {
    timeout: 8000,
  });
  const start = Date.now();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  await expect(overview).toBeVisible();
  await setReviewCapacity(page, 10);
  const startupMs = Date.now() - start;
  expect(submissions).toBe(1);
  await page
    .getByRole("button", { name: "Reset playback", exact: true })
    .click();
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  const reviews = Number(run.events[0].model.alert);
  await expect(overview.locator("strong")).toHaveText([
    "1",
    String(reviews),
    String(1 - reviews),
  ]);
  const flagged = run.events.find(
    (event: { model: { alert: boolean } }) => event.model.alert,
  );
  await page.getByRole("button", { name: "Flagged only", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Inspect ${flagged.eventId}`, exact: true })
    .click();
  const detail = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  await expect(detail).toContainText("Purchase amount");
  await expect(
    detail.getByRole("figure", { name: "How inputs move review priority" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("region", { name: "Ranking evidence" }),
  ).toBeVisible();
  await expect(overview.locator("strong")).toHaveText([
    "1",
    String(reviews),
    String(1 - reviews),
  ]);
  await expect(detail).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("model-explanation.png") });
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("complementary", {
    name: "Completed run totals",
  });
  await expect(results).not.toContainText("334,777");
  await expect(results).not.toContainText("97.72%");
  await expect(results).not.toContainText("Model evaluation scope");
  const outcomes = [0, 0, 0, 0];
  for (const event of run.events) {
    const label = run.scenarioSnapshot.groundTruth[event.eventId];
    if (!label) continue;
    const flagged = event.model.alert;
    const index = label === "fraudulent" ? (flagged ? 0 : 1) : flagged ? 2 : 3;
    outcomes[index]!++;
  }
  await expect(results.locator(".result-detection strong")).toHaveText(
    outcomes.map(String),
  );
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const samples = page.getByRole("dialog", { name: "Start with a sample." });
  await samples.getByText("Model evaluation scope", { exact: true }).click();
  await expect(samples.locator(".model-validation")).toContainText(
    "not independent validation",
  );
  await expect(samples.locator(".model-validation")).toContainText(
    "exposed development datasets",
  );
  await expect(
    samples.getByRole("region", { name: "Sample results" }),
  ).not.toContainText("334,777");
  await page.screenshot({
    path: testInfo.outputPath("samples-model-evaluation.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await testInfo.attach("startup-timing", {
    body: JSON.stringify({
      transactions: 5000,
      preparationMs,
      startupMs,
      submissions,
    }),
    contentType: "application/json",
  });
  console.info(
    `5000 payments: preparation ${preparationMs}ms; click-to-playback ${startupMs}ms; ${submissions} inference request.`,
  );
  expect(errors).toEqual([]);
});
