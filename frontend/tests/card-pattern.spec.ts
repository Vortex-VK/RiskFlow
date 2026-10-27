import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("results retain specialist diagnostics without supplementary review queues or ranked payments", async ({
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
  const run = await (await response).json();
  expect(run.engineVersion).toBe("engine-ml-upload-v9");
  for (const event of run.events) {
    expect(event.model.score.probabilityAvailable).toBe(true);
    expect(event.model.probabilityAvailable).toBe(true);
    expect(event.model.score.rawMargin).toBe(
      event.model.rawScores[event.model.score.source],
    );
    expect(event.model.alert).toBe(
      event.model.score.value >= event.model.score.referenceValue,
    );
  }
  const scoredCards = run.events.filter(
    (e: { cardScores: unknown }) => e.cardScores,
  );
  expect(scoredCards.length).toBeGreaterThan(4);
  expect(
    scoredCards.some(
      (e: { cardScores: { pattern: { distance: number } } }) =>
        e.cardScores.pattern.distance < 0,
    ),
  ).toBe(true);
  const suggestions = run.events.filter(
    (e: { cardPattern: unknown }) => e.cardPattern,
  );
  expect(suggestions).toHaveLength(1);
  for (const e of suggestions) {
    expect(e.model.alert).toBe(false);
    expect(e.decision).toBe("approve");
    expect(e.cardPattern.modelDecisionChanged).toBe(false);
    expect(e.cardPattern.version).toBe("card-pattern-v5");
    expect(e.cardPattern.priority.level === "prioritized").toBe(
      e.cardPattern.priority.margin >= e.cardPattern.priority.threshold,
    );
  }
  expect(run.metrics.flaggedCount).toBe(
    run.events.filter((e: { model: { alert: boolean } }) => e.model.alert)
      .length,
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
  await page.getByText("Additional card model scores", { exact: true }).click();
  const continuous = page.getByRole("region", {
    name: "Continuous model scores",
    exact: true,
  });
  await expect(continuous.getByRole("meter")).toHaveCount(2);
  await expect(continuous).toContainText("Card specialist");
  await expect(continuous).toContainText("Estimated fraud probabilities");
  await expect(continuous).toContainText(
    "not confirmed fraud or measured accuracy",
  );
  await continuous.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/continuous-scores-payment.png" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
