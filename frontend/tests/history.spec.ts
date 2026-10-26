import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("retained uploads can preview more source rows than sandbox payments", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const history = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await history.getByLabel("Dataset name").fill("Retained row boundary");
  await history.getByLabel("Source namespace").fill("retained-row-boundary");
  await history
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(history.getByLabel("Import into this dataset")).toBeEnabled();
  const csv = [
    "transaction_id,account_id,timestamp,amount,currency,direction,transaction_type,status",
    ...Array.from(
      { length: 10_001 },
      (_, i) =>
        `${i},account,2026-01-01T00:00:00Z,1.00,USD,outgoing,transfer,completed`,
    ),
  ].join("\n");
  await history.getByLabel("Import into this dataset").setInputFiles({
    name: "retained-transfers.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  const preview = history.getByRole("region", {
    name: "Retained import preview",
  });
  await expect(preview).toContainText("10001 added");
  await expect(preview).toContainText("10001 rows retained without assessment");
  await expect(
    history.getByRole("button", { name: "Commit records" }),
  ).toBeEnabled();
});

test("large retained imports expose unsupported activity separately from risk scores", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const history = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await history.getByLabel("Dataset name").fill("Reference population");
  await history.getByLabel("Source namespace").fill("reference-bank");
  await history
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(history.getByLabel("Import into this dataset")).toBeEnabled();
  await history
    .getByLabel("Import into this dataset")
    .setInputFiles(
      "../fixtures/evaluations/simulator-v2/riskflow_simulator_realistic_2400.csv",
    );
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  const preview = history.getByRole("region", {
    name: "Retained import preview",
  });
  await expect(preview).toContainText("2400 added");
  await expect(preview).toContainText("2400 rows retained without assessment");
  await history.getByRole("button", { name: "Commit records" }).click();
  await expect(history).toContainText("2400 retained records · revision 1");
  await history.getByLabel("Analysis mode").selectOption("model");
  await history
    .getByRole("button", { name: "Assess retained history" })
    .click();
  const results = history.getByRole("region", {
    name: "Retained assessment results",
  });
  await expect(results).toContainText("0 partial · 2400 not assessed");
  await results.getByLabel("Find payment").fill("TXN-RFSIM-2026-002101");
  await expect(results).toContainText("not assessed · Not scored");
  await expect(
    history.getByRole("button", { name: "Replay assessed purchases" }),
  ).toHaveCount(0);
});

test("explicit datasets retain overlapping history and frozen assessments across refresh", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const history = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await history.getByLabel("Dataset name").fill("Retained browser test");
  await history.getByLabel("Source namespace").fill("browser-bank");
  await history
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(history.getByLabel("Import into this dataset")).toBeVisible();
  const datasetId = await history.getByLabel("Open dataset").inputValue();
  await expect(history.getByLabel("Import into this dataset")).toBeEnabled();
  await history
    .getByLabel("Import into this dataset")
    .setInputFiles("../fixtures/evaluations/simulator-v2/burst-first.csv");
  await expect(
    history.getByRole("button", { name: "Preview retained import" }),
  ).toBeEnabled();
  await expect(
    history.locator("details").filter({
      has: page.locator("summary", { hasText: "Columns & format" }),
    }),
  ).not.toHaveAttribute("open");
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  await expect(
    history.getByRole("region", { name: "Retained import preview" }),
  ).toContainText("4 added");
  await history.getByRole("button", { name: "Commit records" }).click();
  await expect(history).toContainText("4 retained records · revision 1");
  await history.getByLabel("Analysis mode").selectOption("model");
  await history
    .getByRole("button", { name: "Assess retained history" })
    .click();
  const results = history.getByRole("region", {
    name: "Retained assessment results",
  });
  await expect(results).toContainText("4 not assessed");
  await expect(history.getByLabel("Import into this dataset")).toBeEnabled();
  await history
    .getByLabel("Import into this dataset")
    .setInputFiles("../fixtures/evaluations/simulator-v2/burst-overlap.csv");
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  await expect(
    history.getByRole("region", { name: "Retained import preview" }),
  ).toContainText("4 added · 2 duplicate");
  await history.getByRole("button", { name: "Commit records" }).click();
  await expect(history).toContainText("8 retained records · revision 2");
  await expect(results).toContainText("Assessment · revision 1");
  await history
    .getByRole("button", { name: "Assess retained history" })
    .click();
  await expect(results).toContainText("8 not assessed");
  await expect(results).toContainText(
    "TXN-RFSIM-2026-002101 · not assessed · Not scored",
  );
  await expect(
    history.getByRole("button", { name: "Replay assessed purchases" }),
  ).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include(".history-panel")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  await history.getByLabel("Open dataset").selectOption(datasetId);
  await expect(history).toContainText("8 retained records · revision 2");
  await history.getByText("Saved assessments (2)", { exact: true }).click();
  await history.getByRole("button", { name: /revision 1 · 4 records/ }).click();
  await expect(results).toContainText("4 not assessed");
  await expect(results).not.toContainText("002101");
  await expect(history.getByLabel("Import into this dataset")).toBeEnabled();
  await history
    .getByLabel("Import into this dataset")
    .setInputFiles("../fixtures/evaluations/simulator-v2/burst.csv");
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  await expect(
    history.getByRole("region", { name: "Retained import preview" }),
  ).toContainText("0 added · 8 duplicate");
  await history.getByRole("button", { name: "Commit records" }).click();
  await expect(history).toContainText("8 retained records · revision 2");
  await history
    .getByRole("button", { name: "Create editable sandbox copy" })
    .click();
  await expect(history).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
