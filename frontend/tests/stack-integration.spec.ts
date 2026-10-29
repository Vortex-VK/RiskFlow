import { setReviewCapacity } from "./workspace-helpers";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openExampleWorkspace } from "./workspace-helpers";

test("installed stack powers adjustable upload queues and factual explanations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/simulations"),
  );
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const run = await (await response).json();
  expect(run.engineVersion).toBe("engine-ml-stack-d5");
  expect(
    run.events.filter((e: { model: { alert: boolean } }) => e.model.alert),
  ).toHaveLength(1);
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(page.getByLabel("Probability threshold")).toHaveCount(0);
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  const overviewSize = await overview.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }));
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  expect(
    await overview.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    })),
  ).toEqual(overviewSize);
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Ranking evidence" }),
  ).toContainText("Purchase amount");
  await expect(page.getByText("Review order", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("figure", { name: "How checks change priority points" }),
  ).toBeVisible();
  const pointSummary = page.locator(".priority-comparison");
  const pointValues = await pointSummary.locator("strong").allTextContents();
  const [difference] = pointValues.map(parseFloat);
  const contributions = await page
    .locator(".priority-contribution")
    .allTextContents();
  expect(
    contributions.reduce((sum, value) => sum + parseFloat(value), 0),
  ).toBeCloseTo(difference!, 1);
  await expect(page.locator(".priority-check-list")).not.toContainText(
    /places higher|places lower/,
  );
  await expect(
    page.getByLabel("Review capacity", { exact: true }),
  ).toBeVisible();
  const capacity = page.getByRole("slider", {
    name: "Review capacity",
    exact: true,
  });
  const initial = await capacity.inputValue();
  await capacity.press("ArrowLeft");
  await expect(capacity).toHaveValue(String(Number(initial) + 1));
  await expect(page.locator("#review-capacity-note")).toHaveCount(0);
  await capacity.press("ArrowRight");
  await expect(capacity).toHaveValue(initial);
  await expect(page.locator("#review-capacity-note")).toHaveCount(0);
  await setReviewCapacity(page, 4);
  await expect(
    page.getByRole("button", { name: "Auto", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: "Review count", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#review-capacity-note")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Ranking evidence" }),
  ).toContainText("review list · 4 payments");
  await expect(pointSummary.locator("strong")).toHaveText(pointValues);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  expect(
    await overview.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    })),
  ).toEqual(overviewSize);
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toContainText("Top 4 across this upload");
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).not.toContainText("90% threshold preview");
  await page.setViewportSize({ width: 1000, height: 900 });
  const compactSize = await overview.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }));
  await page.getByRole("button", { name: "Results", exact: true }).click();
  expect(
    await overview.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    })),
  ).toEqual(compactSize);
});

test("date-only CSV with missing optional fields can be imported and ranked", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "portable.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "payment_id,date,amount,account_id,merchant_id,currency\na,2026-01-01,10,acct,shop,USD\nb,2026-01-01,30,acct,shop,USD\nc,2026-01-02,20,acct,shop,USD\n",
    ),
  });
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/simulations"),
  );
  await page.getByRole("button", { name: "Preview graph" }).click();
  const run = await (await response).json();
  expect(run.events).toHaveLength(3);
  expect(
    run.events.map(
      (e: { model: { historyCount: number } }) => e.model.historyCount,
    ),
  ).toEqual([0, 0, 2]);
  expect(
    run.events.every(
      (e: { model: { ranking: { timePrecision: string } } }) =>
        e.model.ranking.timePrecision === "day",
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Build graph" }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
