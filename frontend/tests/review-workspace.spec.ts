import { setPlaybackPosition } from "./workspace-helpers";
import { setReviewCapacity } from "./workspace-helpers";
import { uploadQueueRun } from "./workspace-helpers";
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
  const run = uploadQueueRun(await (await response).json(), 10);
  await setReviewCapacity(page, 10);
  const flagged = run.events.filter(
    (e: { model: { alert: boolean } }) => e.model.alert,
  );
  expect(flagged.length).toBeGreaterThan(1);
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  await setPlaybackPosition(page, -1);
  const totals = overview.locator("strong");
  await expect(totals).toHaveText(["0", "0", "0"]);
  await expect(overview).toHaveCSS("transform", "none");
  const initialSummaryBox = await overview.boundingBox();
  const numberPositions = () =>
    overview.locator(".overview-metric").evaluateAll((nodes) =>
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
    await setPlaybackPosition(page, count - 1);
    const reviewCount = run.events
      .slice(0, count)
      .filter((e: { model: { alert: boolean } }) => e.model.alert).length;
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
  await expect(page.getByLabel("Probability threshold")).toHaveCount(0);
  await setPlaybackPosition(page, 6);
  const previousReviews = run.events
    .slice(0, 7)
    .filter((e: { model: { alert: boolean } }) => e.model.alert).length;
  await expect(totals).toHaveText([
    "7",
    String(previousReviews),
    String(7 - previousReviews),
  ]);
  expect(await sumGroupCounts()).toBe(previousReviews);
  await setPlaybackSpeed(page, 5);
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
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const results = page.getByRole("region", { name: "Dataset results" });
  await expect(results).toContainText("Top 10 across this upload");
  await expect(
    results.getByRole("button", {
      name: `Inspect ${flagged.length} flagged payments`,
    }),
  ).toBeVisible();
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
      .getByText(
        `#${run.events.filter((e) => e.model!.ranking!.rawMargin > flagged[0].model!.ranking!.rawMargin).length + 1} of ${run.events.length}`,
        {
          exact: true,
        },
      ),
  ).toHaveCount(1);
  await expect(detail).toContainText("Inside your");
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
  await expect(
    detail.getByRole("region", { name: "Ranking evidence" }),
  ).toBeVisible();
  await expect(detail.locator(".contribution-track")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("payment-detail.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(results).toContainText("Top 10 across this upload");
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
    name: "Play again",
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
