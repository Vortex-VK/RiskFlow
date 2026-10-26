import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test("lifecycle accounting, reviewed corrections and historical snapshots survive reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await panel.getByLabel("Dataset name").fill("Lifecycle browser");
  await panel.getByLabel("Source namespace").fill("lifecycle-browser");
  await panel
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(panel.getByLabel("Import into this dataset")).toBeVisible();
  const datasetId = await panel.getByLabel("Open dataset").inputValue();
  const source = readFileSync(
    "../fixtures/evaluations/simulator-v2/lifecycle.csv",
    "utf8",
  );
  await expect(panel.getByLabel("Import into this dataset")).toBeEnabled();
  await panel.getByLabel("Import into this dataset").setInputFiles({
    name: "lifecycle.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(source),
  });
  await panel.getByRole("button", { name: "Preview retained import" }).click();
  await expect(
    panel.getByRole("region", { name: "Retained import preview" }),
  ).toContainText("8 added");
  await panel.getByRole("button", { name: "Commit records" }).click();
  await expect(panel).toContainText("8 retained records · revision 1");
  await panel.getByRole("button", { name: "Assess retained history" }).click();
  const results = panel.getByRole("region", {
    name: "Retained assessment results",
  });
  const ledger = results.getByRole("region", { name: "Transaction lifecycle" });
  await expect(ledger).toContainText("Recognized net outflow40.00");
  await expect(results).toContainText("0 partial · 8 not assessed");
  const corrected = source.replace(
    "2026-10-01T10:03:00.000Z,40,USD",
    "2026-10-02T10:03:00.000Z,50,USD",
  );
  expect(corrected).not.toBe(source);
  await expect(panel.getByLabel("Import into this dataset")).toBeEnabled();
  await panel.getByLabel("Import into this dataset").setInputFiles({
    name: "corrected.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(corrected),
  });
  await panel.getByRole("button", { name: "Preview retained import" }).click();
  const preview = panel.getByRole("region", {
    name: "Retained import preview",
  });
  await expect(preview).toContainText("7 duplicate · 1 conflict");
  await expect(
    panel.getByRole("button", { name: "Commit records" }),
  ).toBeDisabled();
  const review = preview.getByRole("region", { name: "Review corrections" });
  await expect(review).toContainText("4000");
  await expect(review).toContainText("5000");
  await review.getByLabel("Accept correction for capture-2").check();
  await review
    .getByLabel("Correction reason")
    .fill("Provider corrected partial capture");
  await review
    .getByRole("button", { name: "Preview selected corrections" })
    .click();
  await expect(preview).toContainText("1 corrected");
  await expect(panel).toContainText("8 retained records · revision 1");
  await panel.getByRole("button", { name: "Commit records" }).click();
  await expect(panel).toContainText("8 retained records · revision 2");
  await expect(ledger).toContainText("Recognized net outflow40.00");
  await panel.getByRole("button", { name: "Assess retained history" }).click();
  await expect(ledger).toContainText("Recognized net outflow50.00");
  await panel.getByText("Historical availability", { exact: true }).click();
  await panel.getByLabel("Use a source-availability cutoff").check();
  await panel
    .getByLabel("Knowledge cutoff (UTC)")
    .fill("2026-10-01T10:08:00.000Z");
  await panel.getByRole("button", { name: "Assess retained history" }).click();
  await expect(results).toContainText(
    "Source availability cutoff: 2026-10-01T10:08:00.000Z",
  );
  await expect(ledger).toContainText("Recognized net outflow40.00");
  await panel.getByText("Retained activity (8)", { exact: true }).click();
  const activity = panel.locator("details").filter({
    has: page.locator("summary", { hasText: "Retained activity (8)" }),
  });
  const record = activity
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^capture-2 ·/ }) })
    .last();
  await record.locator("summary").first().click();
  await record.getByRole("button", { name: "Show record versions" }).click();
  await expect(record).toContainText("2 retained versions");
  await expect(record).toContainText("Provider corrected partial capture");
  const accessibility = await new AxeBuilder({ page })
    .include(".history-panel")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  await panel.getByLabel("Open dataset").selectOption(datasetId);
  await expect(panel).toContainText("8 retained records · revision 2");
  await panel.getByText("Saved assessments (3)", { exact: true }).click();
  await panel.getByRole("button", { name: /revision 1 · 8 records/ }).click();
  await expect(ledger).toContainText("Recognized net outflow40.00");
});
