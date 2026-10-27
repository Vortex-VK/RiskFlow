import { expect, test } from "@playwright/test";
import { openExampleWorkspace } from "./workspace-helpers";

test("original generated CSV is rejected at import and preserves the existing graph", async ({
  page,
}) => {
  test.setTimeout(60000);
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("Import purpose").selectOption("model");
  await page
    .getByLabel("CSV file")
    .setInputFiles(
      "../fixtures/evaluations/simulator-v2/riskflow_simulator_realistic_2400.csv",
    );
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(page.getByRole("alert")).toContainText("1953 of 1953 payments");
  await expect(page.getByRole("alert")).toContainText("choose Graph only");
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Build graph" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
});

test("a mixed valid and unsupported import cannot reuse an earlier preview and can be corrected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("Import purpose").selectOption("model");
  const valid =
    "timestamp,amount,merchant_name,channel,mcc,status\n2026-10-20T09:00:00Z,12,Shop,Chip Transaction,5411,completed";
  const upload = async (text: string) => {
    await page.getByLabel("CSV file").setInputFiles({
      name: "payments.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(text),
    });
    await page.getByRole("button", { name: "Preview graph" }).click();
  };
  await upload(valid);
  await expect(page.getByRole("button", { name: "Build graph" })).toBeVisible();
  await upload(
    valid + "\n2026-10-20T10:00:00Z,20,Shop,Chip Transaction,,completed",
  );
  await expect(page.getByRole("alert")).toContainText("1 of 2 payments");
  await expect(page.getByRole("button", { name: "Build graph" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await upload(valid);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(
    page.getByRole("button", { name: "Payments 1", exact: true }),
  ).toBeVisible();
});

test("assumption-based generated CSV keeps labels unknown and exposes scoped probability estimates", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles(
      "../fixtures/evaluations/generated-2400/assumed-chip-brand.csv",
    );
  await page.getByRole("button", { name: "Preview graph" }).click();
  const preview = page.getByRole("region", { name: "Import preview" });
  await expect(preview).toContainText("1615 payments");
  await expect(preview).not.toContainText(
    "Missing model inputs prevent simulation",
  );
  await page.getByRole("button", { name: "Build graph" }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const received = await response;
  expect(received.ok()).toBe(true);
  const result = await received.json();
  expect(result.engineVersion).toBe("engine-ml-upload-v9");
  expect(result.events).toHaveLength(1615);
  expect(result.metrics.labeledCount).toBe(0);
  expect(
    result.events.every(
      (e: { model: { probabilityAvailable: boolean; version: string } }) =>
        e.model.probabilityAvailable === true &&
        e.model.version === "ml-upload-v9",
    ),
  ).toBe(true);
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await expect(page.getByRole("status")).not.toContainText("Extra inputs");
});
