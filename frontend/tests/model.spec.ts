import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openExampleWorkspace } from "./workspace-helpers";

test("an old running backend gives restart guidance and retry preserves the draft", async ({
  page,
}) => {
  let submissions = 0;
  let healthChecks = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/simulations")) submissions++;
  });
  await page.route("**/api/v1/health", (route) => {
    healthChecks++;
    if (healthChecks === 1) return route.continue();
    return route.fulfill({
      json: { status: "ok", schemaVersion: 1, engineVersion: "engine-v1" },
    });
  });
  await openExampleWorkspace(page);
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
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const first = await (await response).json();
  expect(first.engineVersion).toBe("engine-ml-upload-v9");
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  const evidence = page.getByRole("region", {
    name: "Model explanation",
  });
  await expect(evidence.locator(".contribution-list li")).toHaveCount(5);
  await evidence
    .getByText("Calculation and model-score details", { exact: true })
    .click();
  await expect(evidence).toContainText("not percentage points");
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
