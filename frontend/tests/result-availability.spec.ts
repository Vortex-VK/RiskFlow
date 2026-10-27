import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/domain/csv";
import type { EventResult } from "../src/domain/runs";
import type { Scenario } from "../src/domain/types";
import { findInvestigationPatterns } from "../src/domain/runInsights";

const table = parseCsv(readFileSync("src/assets/sample-payments.csv", "utf8"));
const labelColumn = table.headers.indexOf("label");
const encode = (cells: string[]) =>
  cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",");

for (const [name, labels] of [
  ["unlabeled", ["", "", ""]],
  ["legitimate-only", ["legitimate", "legitimate", "legitimate"]],
  ["fraud-only partial", ["fraudulent", "", ""]],
  ["both classes partial", ["fraudulent", "legitimate", ""]],
] as const) {
  test(`${name} results show only supported measurements`, async ({
    page,
  }, testInfo) => {
    const csv = [
      encode(table.headers),
      ...table.rows.map((row, index) => {
        const cells = [...row.cells];
        cells[labelColumn] = labels[index]!;
        return encode(cells);
      }),
    ].join("\n");
    await page.goto("/");
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await page.getByLabel("CSV file").setInputFiles({
      name: "outcomes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    const prepared = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/simulations"),
    );
    await page
      .getByRole("button", { name: "Preview graph", exact: true })
      .click();
    const run = await (await prepared).json();
    await page
      .getByRole("button", { name: "Build graph", exact: true })
      .click();
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    await page.getByRole("button", { name: "Results", exact: true }).click();
    const results = page.getByRole("complementary", {
      name: "Completed run totals",
    });
    await expect(
      results.getByRole("region", { name: "Score evaluation", exact: true }),
    ).toHaveCount(0);
    await expect(results).not.toContainText("N/A");
    await expect(
      results.getByRole("region", { name: "Where alerts concentrate" }),
    ).toBeVisible();
    await expect(
      results.getByRole("region", { name: "Patterns worth investigating" }),
    ).toBeVisible();
    await expect(
      results.getByRole("region", { name: "Probability distribution" }),
    ).toBeVisible();
    const flagged = run.events.filter(
      (event: { model: { alert: boolean } }) => event.model.alert,
    ).length;
    await expect(
      results.getByRole("button", {
        name: `Inspect ${flagged} flagged payments`,
      }),
    ).toBeVisible();
    const positive = labels.filter((label) => label === "fraudulent").length;
    const negative = labels.filter((label) => label === "legitimate").length;
    const labeled = positive + negative;
    await expect(results.getByText("Recall", { exact: true })).toHaveCount(
      positive ? 1 : 0,
    );
    await expect(
      results.getByText("frauds found", { exact: true }),
    ).toHaveCount(positive ? 1 : 0);
    await expect(
      results.getByText("false alerts", { exact: true }),
    ).toHaveCount(negative ? 1 : 0);
    if (!labeled) {
      await expect(results.locator(".result-detection")).toHaveCount(0);
      await expect(results.getByText("Precision", { exact: true })).toHaveCount(
        0,
      );
      await expect(results).toContainText("No outcome labels supplied");
    } else if (labeled < run.events.length) {
      await expect(results).toContainText(
        `${run.events.length - labeled} unlabeled payments excluded`,
      );
    }
    await expect(results).toHaveCSS("opacity", "1");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await results.screenshot({ path: testInfo.outputPath("results.png") });
  });
}

test("insight links follow the threshold without advancing playback", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/samples/card-pattern-demo.csv");
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/simulations"),
  );
  await page
    .getByRole("button", { name: "Preview graph", exact: true })
    .click();
  const response = await pending;
  const run = (await response.json()) as { events: EventResult[] };
  const scenario = response.request().postDataJSON().scenario as Scenario;
  await page.getByRole("button", { name: "Build graph", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset playback", exact: true })
    .click();
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  const threshold = page.getByRole("slider", {
    name: /^Probability threshold/,
  });
  await threshold.press("Home");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const concentration = page.getByRole("region", {
    name: "Where alerts concentrate",
  });
  const groups = new Map<string, EventResult[]>();
  for (const e of run.events)
    groups.set(e.accountId, [...(groups.get(e.accountId) ?? []), e]);
  const largest = [...groups.values()].sort(
    (a, b) =>
      b.length - a.length ||
      b.reduce((n, e) => n + e.amountMinor, 0) -
        a.reduce((n, e) => n + e.amountMinor, 0) ||
      a[0]!.accountId.localeCompare(b[0]!.accountId),
  )[0]!;
  await concentration.locator(".concentration-row").first().click();
  const queue = page.getByRole("region", { name: "Run events" });
  await expect(queue).toContainText(
    `${largest.length} matching flagged payments`,
  );
  await expect(queue.locator(".payment-result")).toHaveCount(
    Math.min(60, largest.length),
  );
  for (const e of largest.slice(0, 60))
    await expect(
      queue.getByRole("button", { name: `Inspect ${e.eventId}`, exact: true }),
    ).toBeVisible();
  await threshold.press("End");
  const at100 = largest.filter((e) => e.model!.score!.value >= 100).length;
  await expect(queue).toContainText(`${at100} matching flagged payments`);
  await threshold.press("Home");
  await expect(queue).toContainText(
    `${largest.length} matching flagged payments`,
  );
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const patterns = page.getByRole("region", {
    name: "Patterns worth investigating",
  });
  const expected = findInvestigationPatterns(scenario.payments);
  const repeatIds = run.events
    .filter((e) => expected.matches.get(e.eventId)?.has("repeat"))
    .map((e) => e.eventId);
  expect(repeatIds.length).toBeGreaterThan(0);
  await expect(patterns).toContainText("Repeat merchant attempts");
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await patterns.screenshot({
    path: testInfo.outputPath("investigation-patterns.png"),
  });
  await patterns
    .getByRole("button", {
      name: "Inspect payments: repeat merchant attempts",
      exact: true,
    })
    .click();
  await expect(queue).toContainText(
    `${repeatIds.length} matching flagged payments`,
  );
  for (const id of repeatIds.slice(0, 60))
    await expect(
      queue.getByRole("button", { name: `Inspect ${id}`, exact: true }),
    ).toBeVisible();
  await queue
    .getByRole("button", { name: "All flagged payments", exact: true })
    .click();
  await expect(
    queue.getByRole("heading", { name: "Payments for review", exact: true }),
  ).toBeVisible();
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
  const lowRisk = run.events.find((e) => !e.model!.alert)!;
  expect(lowRisk).toBeTruthy();
  const explanation = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/explanations"),
  );
  await queue
    .getByRole("button", { name: `Inspect ${lowRisk.eventId}`, exact: true })
    .click();
  const data = await (await explanation).json();
  const detail = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  await page
    .getByRole("button", { name: "Reset defaults", exact: true })
    .click();
  await expect(
    detail.getByRole("region", { name: "Review decision" }),
  ).toContainText("No alert.");
  const chart = detail.getByRole("figure", {
    name: "From starting estimate to final probability",
  });
  await expect(chart).toBeVisible();
  await expect(chart.locator("svg.probability-plot")).toHaveCount(1);
  await expect(chart.locator(".probability-track")).toHaveCount(0);
  expect((await chart.locator("svg").boundingBox())!.height).toBeLessThan(210);
  const modelExplanation = detail.getByRole("region", {
    name: "Model explanation",
    exact: true,
  });
  await expect(
    modelExplanation.getByRole("region", {
      name: "Available evidence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(modelExplanation.locator(":scope > details")).toHaveCount(1);
  const other = chart.locator(".other-factor-details");
  const otherSummary = other.locator("summary");
  const remaining = Number(
    (await otherSummary.textContent())!.match(/Other (\d+) factors/)![1],
  );
  await expect(other).not.toHaveAttribute("open");
  const finalBeforeExpansion = await chart
    .locator(".probability-final .probability-step-heading")
    .textContent();
  await otherSummary.click();
  await expect(
    other.getByRole("list", { name: "Other contributing factors" }),
  ).toBeVisible();
  await expect(other.locator("li")).toHaveCount(remaining);
  const percentNumber = (text: string) =>
    Number(text.replace("−", "-").replace("%", ""));
  const expandedTotal = (
    await other.locator(".other-factor-change").allTextContents()
  ).reduce((sum, text) => sum + percentNumber(text), 0);
  expect(expandedTotal).toBeCloseTo(
    percentNumber((await otherSummary.locator("strong").textContent())!),
    6,
  );
  const finalText = (await chart
    .locator(".probability-final .probability-step-heading strong")
    .last()
    .textContent())!;
  await expect(other.locator(".other-factor-running span").last()).toHaveText(
    finalText,
  );
  expect(
    await chart
      .locator(".probability-final .probability-step-heading")
      .textContent(),
  ).toBe(finalBeforeExpansion);
  await expect(chart.locator("svg.probability-plot")).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await other.locator("li").first().scrollIntoViewIfNeeded();
  await detail.screenshot({
    path: testInfo.outputPath("expanded-other-factors.png"),
  });
  await otherSummary.click();
  await expect(other).not.toHaveAttribute("open");
  await modelExplanation
    .getByText("Calculation and model-score details", { exact: true })
    .click();
  await expect(
    modelExplanation.getByRole("heading", {
      name: "Decision score details",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    modelExplanation.getByRole("heading", {
      name: "Assessment scope",
      exact: true,
    }),
  ).toBeVisible();
  await modelExplanation
    .getByText("Calculation and model-score details", { exact: true })
    .click();
  const total =
    data.baseValue +
    data.contributions.reduce(
      (sum: number, r: { contribution: number }) => sum + r.contribution,
      0,
    );
  expect(total).toBeCloseTo(data.rawMargin, 6);
  expect(data.rawMargin).toBeCloseTo(lowRisk.model!.score!.rawMargin, 6);
  await expect(detail.locator(".contribution-value").first()).toHaveText(
    /^(?:[+−]\d+|0)\.\d{2,6}%$/,
  );
  await expect(detail.locator(".contribution-track")).toHaveCount(0);
  const stepsBefore = await detail
    .locator(".contribution-value")
    .allTextContents();
  const estimateBefore = await detail
    .locator(".probability-final .probability-step-heading")
    .textContent();
  let additionalExplanations = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/explanations"))
      additionalExplanations++;
  });
  await threshold.press("Home");
  await expect(detail.locator(".probability-final")).toHaveClass(/raises-risk/);
  await expect(detail.locator(".probability-final")).toContainText(
    "above the preview threshold",
  );
  await threshold.press("End");
  await expect(detail.locator(".probability-final")).toHaveClass(/lowers-risk/);
  await expect(detail.locator(".probability-final")).toContainText(
    "below the preview threshold",
  );
  await expect(detail.locator(".probability-cutoff").first()).toHaveAttribute(
    "data-threshold",
    "100",
  );
  expect(await detail.locator(".contribution-value").allTextContents()).toEqual(
    stepsBefore,
  );
  expect(
    await detail
      .locator(".probability-final .probability-step-heading")
      .textContent(),
  ).toBe(estimateBefore);
  expect(additionalExplanations).toBe(0);
  await page
    .getByRole("button", { name: "Reset defaults", exact: true })
    .click();
  await chart.scrollIntoViewIfNeeded();
  await expect(detail).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await detail.screenshot({
    path: testInfo.outputPath("low-risk-explanation.png"),
  });
});
