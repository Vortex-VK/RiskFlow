import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setPlaybackSpeed } from "./workspace-helpers";

test("review counts follow visible playback and completed inspection keeps the final graph", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/simulations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Open in workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Payments 250", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/, {
    timeout: 8000,
  });
  const before = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page.screenshot({ path: testInfo.outputPath("before-simulation.png") });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const run = await (await response).json();
  const flagged = run.events.filter(
    (e: { model: { score: { value: number } } }) => e.model.score.value >= 90,
  );
  expect(flagged.length).toBeGreaterThan(1);
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  await page
    .getByRole("button", { name: "Reset playback", exact: true })
    .click();
  const totals = overview.locator("strong");
  await expect(totals).toHaveText(["0", "0", "0"]);
  await expect(overview).toHaveCSS("transform", "none");
  const initialSummaryBox = await overview.boundingBox();
  const numberPositions = () =>
    totals.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, width: box.width };
      }),
    );
  const initialNumberPositions = await numberPositions();
  await expect(page.locator(".sector-review-count")).toHaveCount(0);
  await expect(page.locator(".transaction-risk")).toHaveAttribute(
    "data-path-count",
    "0",
  );
  const sumGroupCounts = () =>
    page
      .locator(".transaction-sector")
      .evaluateAll((nodes) =>
        nodes.reduce(
          (sum, node) => sum + Number(node.getAttribute("data-review-count")),
          0,
        ),
      );
  // Step through real results, including both alert and no-alert payments.
  for (let count = 1; count <= 8; count++) {
    await page.getByRole("button", { name: "Next event", exact: true }).click();
    const reviewCount = run.events
      .slice(0, count)
      .filter(
        (e: { model: { score: { value: number } } }) =>
          e.model.score.value >= 90,
      ).length;
    await expect(totals).toHaveText([
      String(count),
      String(reviewCount),
      String(count - reviewCount),
    ]);
    expect(await sumGroupCounts()).toBe(reviewCount);
    // Different digits must not move neighboring counts or resize the card.
    expect(await overview.boundingBox()).toEqual(initialSummaryBox);
    expect(await numberPositions()).toEqual(initialNumberPositions);
  }
  const threshold = page.getByRole("slider", {
    name: /^Probability threshold/,
  });
  await threshold.press("Home");
  await expect(totals).toHaveText(["8", "8", "0"]);
  expect(await sumGroupCounts()).toBe(8);
  await threshold.fill("90");
  await page
    .getByRole("button", { name: "Previous event", exact: true })
    .click();
  const previousReviews = run.events
    .slice(0, 7)
    .filter(
      (e: { model: { score: { value: number } } }) => e.model.score.value >= 90,
    ).length;
  await expect(totals).toHaveText([
    "7",
    String(previousReviews),
    String(7 - previousReviews),
  ]);
  expect(await sumGroupCounts()).toBe(previousReviews);
  await setPlaybackSpeed(page, 10);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Run complete", {
    timeout: 30000,
  });
  await expect(totals).toHaveText([
    "250",
    String(flagged.length),
    String(250 - flagged.length),
  ]);
  await expect(
    page.getByRole("button", { name: "Fit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Connections/ })).toHaveCount(
    0,
  );
  await threshold.press("Home");
  await expect(totals).toHaveText(["250", "250", "0"]);
  await expect(page.getByRole("status")).toContainText(
    "0 no alert \u00b7 250 for review \u00b7 Threshold preview",
  );
  expect(await sumGroupCounts()).toBe(250);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("region", { name: "Dataset results" });
  await expect(results).toContainText("0% threshold preview");
  await expect(
    results.getByRole("button", { name: "Inspect 250 flagged payments" }),
  ).toBeVisible();
  const frauds = Object.values(run.scenarioSnapshot.groundTruth).filter(
    (label) => label === "fraudulent",
  ).length;
  await expect(results).toContainText(
    `${frauds} of ${frauds} labeled frauds flagged`,
  );
  await expect(
    results.getByRole("region", { name: "Where alerts concentrate" }),
  ).toBeVisible();
  await expect(
    results.getByRole("region", { name: "Patterns worth investigating" }),
  ).toBeVisible();
  for (const removed of [
    "Score evaluation",
    "Additional analysis",
    "Run information",
    "Ranked payments",
    "Experimental card reviews",
  ])
    await expect(
      page.getByRole("complementary", { name: "Completed run totals" }),
    ).not.toContainText(removed);
  await page.getByRole("button", { name: "Close results" }).click();
  await threshold.press("End");
  const at100 = run.events.filter(
    (e: { model: { score: { value: number } } }) => e.model.score.value >= 100,
  ).length;
  await expect(totals).toHaveText(["250", String(at100), String(250 - at100)]);
  await threshold.fill("90");
  await expect(totals).toHaveText([
    "250",
    String(flagged.length),
    String(250 - flagged.length),
  ]);
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    before!,
  );
  const groupCounts = await page
    .locator(".transaction-sector")
    .evaluateAll((nodes) =>
      nodes.reduce(
        (sum, node) => sum + Number(node.getAttribute("data-review-count")),
        0,
      ),
    );
  expect(groupCounts).toBe(flagged.length);
  expect(
    Number(
      await page.locator(".transaction-risk").getAttribute("data-path-count"),
    ),
  ).toBeGreaterThan(0);
  const filter = page.getByRole("button", {
    name: "Flagged only",
    exact: true,
  });
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    before!,
  );
  await page.screenshot({ path: testInfo.outputPath("after-simulation.png") });
  await overview
    .getByRole("button", { name: `${flagged.length} need review` })
    .click();
  const events = page.getByRole("region", { name: "Run events" });
  await expect(
    events.getByRole("button", { name: /^Inspect CSV/ }),
  ).toHaveCount(flagged.length);
  await events
    .getByRole("button", { name: `Inspect ${flagged[0].eventId}`, exact: true })
    .click();
  const detail = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  await expect(detail).toContainText("Review recommended");
  await expect(
    detail
      .locator(".payment-verdict")
      .getByText(`${flagged[0].model.score.value.toFixed(2)}%`, {
        exact: true,
      }),
  ).toHaveCount(1);
  await expect(detail).toContainText("Meets 90.00% threshold · For review.");
  await expect(detail.locator(".continuous-score")).toHaveCount(0);
  const selectedMerchant = page.locator(
    `[data-node="${flagged[0].merchantId}"]`,
  );
  await expect(selectedMerchant).toHaveAttribute("data-review", "selected");
  await expect(selectedMerchant.locator(".node-review-ring")).toHaveAttribute(
    "stroke-width",
    "3",
  );
  await expect(selectedMerchant.locator(".node-review-badge")).toBeVisible();
  await expect(page.locator(".payment-pulse")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Run complete");
  await expect(
    page.getByRole("navigation", { name: "Playback controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Playback speed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next flagged", exact: true }).click();
  await expect(detail.getByRole("heading").first()).toContainText(
    flagged[1].eventId,
  );
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-detail",
    "true",
  );
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await expect(detail.locator(".contribution-list li")).toHaveCount(5);
  await expect(
    detail.getByRole("figure", {
      name: "From starting estimate to final probability",
    }),
  ).toBeVisible();
  await expect(detail.locator(".contribution-track")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("payment-detail.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(results).toContainText("90% threshold preview");
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("dataset-results.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(
    page.getByRole("region", { name: "Score evaluation", exact: true }),
  ).toHaveCount(0);
  const nextFlagged = page.getByRole("button", {
    name: "Next flagged",
    exact: true,
  });
  const replayButton = page.getByRole("button", {
    name: "Replay",
    exact: true,
  });
  expect(
    await nextFlagged.evaluate((element) => getComputedStyle(element).color),
  ).toBe(
    await replayButton.evaluate((element) => getComputedStyle(element).color),
  );
  await page.getByRole("button", { name: "Close results" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Next flagged", exact: true }).click();
  await expect(detail).toBeVisible();
  await expect(detail).toHaveCSS("opacity", "1");
  const controls = await page
    .getByRole("navigation", { name: "Playback controls" })
    .boundingBox();
  const panel = await detail.boundingBox();
  expect(panel!.y + panel!.height).toBeLessThan(controls!.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("mobile-detail.png") });
  expect(errors).toEqual([]);
});
