import { uploadQueueRun } from "./workspace-helpers";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("results use the stack queue without separate legacy specialist alerts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/samples/card-pattern-demo.csv");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const run = uploadQueueRun(await (await response).json());
  expect(run.engineVersion).toBe("engine-ml-stack-d5");
  for (const event of run.events) {
    expect(event.model.probabilityAvailable).toBe(false);
    expect(event.model.score).toBeNull();
    expect(event.model.ranking.rawMargin).toBe(event.model.rawScores.stack_d5);
    expect(event.cardScores).toBeNull();
    expect(event.cardPattern).toBeNull();
  }
  const suggestions = run.events.filter(
    (e: { model: { alert: boolean } }) => e.model.alert,
  );
  expect(suggestions.length).toBeGreaterThan(0);
  await expect(page.getByLabel("Review capacity", { exact: true })).toHaveValue(
    String(suggestions.length),
  );
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("complementary", {
    name: "Completed run totals",
  });
  for (const removed of [
    "Score evaluation",
    "Additional analysis",
    "Experimental card reviews",
    "Ranked payments",
    "Run information",
  ])
    await expect(results).not.toContainText(removed);
  await expect(results.locator(".score-explorer")).toHaveCount(0);
  await expect(
    results.getByRole("region", { name: "Where alerts concentrate" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Find payment", exact: true })
    .fill(suggestions[0].eventId);
  await page
    .getByRole("button", {
      name: `Inspect ${suggestions[0].eventId}`,
      exact: true,
    })
    .click();
  const evidence = page.getByRole("region", { name: "Ranking evidence" });
  await expect(evidence).toBeVisible();
  await expect(evidence).toContainText("Purchase amount");
  await expect(
    page.getByText("Additional card model scores", { exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
