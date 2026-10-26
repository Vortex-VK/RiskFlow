import { test, expect } from "@playwright/test";

test("ordinary date-only uploads support explicit descriptive analysis and immutable reopen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Datasets", exact: true }).click();
  const history = page.getByRole("region", {
    name: "Saved datasets",
    exact: true,
  });
  await history.getByLabel("Dataset name").fill("Behavioral example");
  await history.getByLabel("Source namespace").fill("behavioral-authored");
  await history
    .getByRole("button", { name: "Create dataset", exact: true })
    .click();
  await expect(history.getByLabel("Analysis mode")).toHaveValue("behavioral");
  await history.getByLabel("Import into this dataset").setInputFiles({
    name: "ordinary.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,date,amount\na,2026-01-01,10\nb,2026-01-02,30\nc,2026-01-03,100\n",
    ),
  });
  await history.getByText("Columns & format", { exact: true }).click();
  await history
    .getByLabel("Currency when absent from the file")
    .selectOption("USD");
  await history
    .getByLabel("Single account ID when absent from the file")
    .fill("personal");
  await history.getByLabel("Missing activity types are purchases").check();
  await history.getByLabel("Missing directions are outgoing").check();
  await history
    .getByRole("button", { name: "Preview retained import" })
    .click();
  await expect(
    history.getByRole("region", { name: "Retained import preview" }),
  ).toContainText("3 added");
  await history.getByRole("button", { name: "Commit records" }).click();
  await history
    .getByRole("button", { name: "Describe purchase history" })
    .click();
  const results = history.getByRole("region", {
    name: "Retained assessment results",
  });
  await expect(results).toContainText("3 partial");
  await results.locator("summary").filter({ hasText: /^c ·/ }).click();
  await expect(results).toContainText("This amount is 10.00 times the median");
  await results.getByRole("button", { name: "a", exact: true }).click();
  await expect(
    results.getByRole("region", { name: "Supporting observation" }),
  ).toContainText("USD 10");
  await expect(
    results.getByRole("button", { name: "Replay assessed purchases" }),
  ).toHaveCount(0);
  await history.getByText("Saved assessments (1)", { exact: true }).click();
  await history.getByRole("button", { name: /revision 1 · 3 records/ }).click();
  await expect(results).toContainText("3 partial");
});
