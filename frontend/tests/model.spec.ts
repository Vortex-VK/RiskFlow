import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openExampleWorkspace } from "./workspace-helpers";

test("an old running backend gives restart guidance and retry preserves the draft", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/simulations")) submissions++;
  });
  await page.route("**/api/v1/health", (route) =>
    route.fulfill({
      json: { status: "ok", schemaVersion: 1, engineVersion: "engine-v1" },
    }),
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Restart the RiskFlow backend",
  );
  expect(submissions).toBe(0);
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/health");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  expect(submissions).toBe(1);
});

test("upload-v9 replay shows model evidence and preserves predictions when old device context changes", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const first = await (await response).json();
  expect(first.engineVersion).toBe("engine-ml-upload-v9");
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  const evidence = page.getByRole("region", {
    name: "Assessment evidence",
  });
  await expect(evidence).toContainText("Assessment evidence");
  await evidence.getByText("Raw model margins", { exact: true }).click();
  await expect(evidence).toContainText("not fraud probabilities");
  await expect(page.locator("body")).not.toContainText(
    /Upload-v\d|\bV13\b|\bV[89] (card|online)\b/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Upload-v\d|engine-ml|\bV13\b|\bV[89] (card|online)\b/,
  );
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H09", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Device", exact: true })
    .selectOption("device-c");
  const next = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const second = await (await next).json();
  expect(second.events.map((e: { model: unknown }) => e.model)).toEqual(
    first.events.map((e: { model: unknown }) => e.model),
  );
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
});

test("supported retained purchases run upload-v9 and reopen their frozen model results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await panel.getByLabel("Dataset name").fill("Upload-v9 purchases");
  await panel.getByLabel("Source namespace").fill("v13-demo");
  await panel
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(panel.getByLabel("Import into this dataset")).toBeEnabled();
  const id = await panel.getByLabel("Open dataset").inputValue();
  await panel
    .getByLabel("Import into this dataset")
    .setInputFiles("../fixtures/runtime/demo-purchases.csv");
  await panel.getByRole("button", { name: "Preview retained import" }).click();
  await panel.getByRole("button", { name: "Commit records" }).click();
  await panel.getByLabel("Analysis mode").selectOption("model");
  await panel.getByRole("button", { name: "Assess retained history" }).click();
  const results = panel.getByRole("region", {
    name: "Retained assessment results",
  });
  await expect(results).toContainText("8 partial");
  await expect(results).toContainText(
    /\d+\.\d{2}% estimated fraud · partial context/,
  );
  await results
    .getByRole("button", { name: "Replay assessed purchases" })
    .click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  await panel.getByLabel("Open dataset").selectOption(id);
  await panel.getByText("Saved assessments (1)", { exact: true }).click();
  await panel.getByRole("button", { name: /revision 1.*8 records/ }).click();
  await expect(results).toContainText(
    /\d+\.\d{2}% estimated fraud · partial context/,
  );
});
