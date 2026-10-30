import { setPlaybackPosition, setReviewCapacity } from "./workspace-helpers";
import { uploadQueueRun } from "./workspace-helpers";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/domain/csv";

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
    const run = uploadQueueRun(await (await prepared).json());
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
    ).toHaveCount(0);
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

test("insight links follow recorded review selections without advancing playback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("src/assets/sample-payments.csv");
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/simulations"),
  );
  await page
    .getByRole("button", { name: "Preview graph", exact: true })
    .click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  expect((await response.json()).events).toHaveLength(3);
  await page.getByRole("button", { name: "Build graph", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await setReviewCapacity(page, 3);
  await setPlaybackPosition(page, -1);
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  await expect(page.getByLabel("Probability threshold")).toHaveCount(0);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const concentration = page.getByRole("region", {
    name: "Where alerts concentrate",
  });
  await concentration.locator(".concentration-row").first().click();
  const queue = page.getByRole("region", { name: "Run events" });
  await expect(
    queue.getByRole("heading", { name: "Accounts: Alice", exact: true }),
  ).toBeVisible();
  await expect(queue.locator(".payment-result")).toHaveCount(2);
  for (const id of ["CSV01", "CSV02"])
    await expect(
      queue.getByRole("button", { name: `Inspect ${id}`, exact: true }),
    ).toBeVisible();
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const patterns = page.getByRole("region", {
    name: "Patterns worth investigating",
  });
  // CSV02 repeats Alice's merchant after 3 minutes; CSV01 has no history,
  // and CSV03 belongs to Bob. Keep this expectation independent of the detector.
  await patterns
    .getByRole("button", {
      name: "Inspect payments: repeat merchant attempts",
      exact: true,
    })
    .click();
  await expect(queue.locator(".payment-result")).toHaveCount(1);
  await expect(
    queue.getByRole("button", { name: "Inspect CSV02", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect 3 flagged payments", exact: true })
    .click();
  await expect(queue.locator(".payment-result")).toHaveCount(3);
  await expect(
    queue.getByRole("heading", { name: "Payments for review", exact: true }),
  ).toBeVisible();
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
  await queue
    .getByRole("button", { name: "Inspect CSV02", exact: true })
    .click();
  const detail = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  await expect(detail).toContainText("Review order");
  await expect(
    detail.getByRole("region", { name: "Ranking evidence" }),
  ).toBeVisible();
  await expect(detail.locator(".probability-plot")).toHaveCount(0);
  await expect(overview.locator("strong")).toHaveText(["0", "0", "0"]);
});
