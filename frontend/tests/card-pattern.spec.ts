import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("card reviews are separate from frozen v9 alerts and disclose labeled mistakes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/samples/card-pattern-demo.csv");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
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
  await page.getByText("Additional analysis", { exact: true }).click();
  await page.getByText("Score evaluation", { exact: true }).click();
  const explorer = page.getByRole("region", {
    name: "Score evaluation",
    exact: true,
  });
  await explorer.getByLabel("Score model").selectOption("card_pattern");
  await expect(explorer).toContainText("Average precision:");
  await expect(explorer).toContainText("ROC AUC:");
  await expect(explorer.getByRole("slider")).toHaveCount(0);
  await explorer.getByText("Ranking & calibration", { exact: true }).click();
  await explorer
    .getByText("Outcomes at the fixed cutoff", { exact: true })
    .click();
  const aboveReference = scoredCards.filter(
    (e: {
      cardScores: { pattern: { value: number; referenceValue: number } };
    }) => e.cardScores.pattern.value >= e.cardScores.pattern.referenceValue,
  ).length;
  await expect(
    explorer.getByRole("row", { name: /^Above cutoff/ }).getByRole("cell"),
  ).toHaveText(String(aboveReference));
  await explorer.getByText("Ranked payments", { exact: true }).click();
  const highEstimates = scoredCards.filter(
    (e: { cardScores: { pattern: { value: number } } }) =>
      e.cardScores.pattern.value >= 90,
  ).length;
  await expect(explorer).toContainText(
    `${highEstimates} transactions have estimates of 90% or higher`,
  );
  await expect(explorer).toContainText("Brier score:");
  await expect(explorer).toContainText("Log loss:");
  await expect(explorer).toContainText("Fraud RMSE:");
  const download = page.waitForEvent("download");
  await explorer.getByRole("button", { name: "Download scores CSV" }).click();
  const file = await download;
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("raw_margin");
  expect(csv.split("\r\n")).toHaveLength(scoredCards.length + 1);
  expect(csv).toContain(String(scoredCards[0].cardScores.pattern.rawMargin));
  await explorer.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/continuous-scores-explorer.png",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByText("Score evaluation", { exact: true }).click();
  await page
    .getByText("Experimental card reviews (1)", { exact: true })
    .click();
  const reviews = page.getByRole("region", {
    name: "Additional card reviews",
    exact: true,
  });
  await expect(reviews).toContainText("1 additional card reviews");
  await expect(reviews).toContainText("0 fraudulent, 1 legitimate");
  const prioritized = reviews.getByRole("region", {
    name: "Prioritized card reviews",
    exact: true,
  });
  const exploratory = reviews.getByRole("region", {
    name: "Exploratory card leads",
    exact: true,
  });
  await expect(prioritized).toContainText("Prioritized card reviews (0)");
  await expect(prioritized).toContainText("No leads in this group.");
  await expect(exploratory).toContainText("Exploratory card leads (1)");
  await expect(exploratory).toContainText("0 fraudulent, 1 legitimate");
  await reviews
    .getByRole("button", { name: /Inspect card review/ })
    .first()
    .click();
  await page
    .locator("summary")
    .filter({ hasText: /^Additional card review$/ })
    .click();
  await page.getByText("Additional card model scores", { exact: true }).click();
  const detail = page.getByRole("region", {
    name: "Card-pattern review",
    exact: true,
  });
  await expect(detail).toContainText(
    "does not identify fraud or change the model metrics",
  );
  await expect(detail).toContainText("Exploratory lead");
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
  await detail.getByText("Review model details", { exact: true }).click();
  await expect(detail).toContainText("not fraud probabilities");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
