import { expect, test } from "@playwright/test";

test("date-only graph investigation does not require or invoke a model", async ({
  page,
}) => {
  let modelRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/simulations") && request.method() === "POST")
      modelRequests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await expect(page.getByLabel("Import purpose")).toHaveValue("model");
  await page.getByLabel("Import purpose").selectOption("graph");
  await page.getByLabel("CSV file").setInputFiles({
    name: "observations.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date,amount,merchant_name,currency\n2026-01-01,10,Shop,USD\n2026-01-02,20,Shop,USD\n",
    ),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("without running a fraud model");
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(
    page.getByRole("button", { name: "Payments 2", exact: true }),
  ).toBeVisible();
  expect(modelRequests).toBe(0);
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeDisabled();
});
