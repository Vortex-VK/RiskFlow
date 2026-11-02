import { openExampleWorkspace, syntheticModelCsv } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Run } from "../src/domain/runs";

test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
});

for (const [file, objects, payments, excluded] of [
  ["riskflow_transactions_s3_285.csv", 116, 232, 53],
  ["riskflow_transactions_l_9000.csv", 681, 7612, 1388],
] as const) {
  test(`imports and simulates ${file} with per-payment merchant categories`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await page.getByLabel("CSV file").setInputFiles({
      name: file,
      mimeType: "text/csv",
      buffer: await syntheticModelCsv(`../fixtures/imports/${file}`),
    });
    await expect(
      page.getByRole("button", { name: "Preview graph" }),
    ).toBeEnabled();
    await expect(
      page.locator("details").filter({
        has: page.locator("summary", { hasText: "Columns & format" }),
      }),
    ).not.toHaveAttribute("open");
    await expect(
      page.getByRole("checkbox", {
        name: "I have reviewed the import assumptions.",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cancel import" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Preview graph" }).click();
    const preview = page.getByRole("region", { name: "Import preview" });
    await expect(preview).toContainText(`${objects} objects`);
    await expect(preview).toContainText(`${payments} payments`);
    await expect(preview).toContainText(`${excluded} rows excluded`);
    await expect(preview).toContainText(
      'Merchant "Walmart" has multiple payment categories',
    );
    await page.getByRole("button", { name: "Build graph" }).click();
    await expect(page.locator(".graph-stage")).toHaveClass(/graph-reveal/);
    await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/, {
      timeout: 8000,
    });
    await expect(page.locator(".atlas-cloud")).toHaveAttribute(
      "data-cloud-payments",
      String(payments),
    );
    const counts = await page
      .locator(".transaction-sector")
      .evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute("data-payment-count"))),
      );
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(payments);
    expect([...counts].sort((a, b) => a - b)).toEqual(
      payments === 7612 ? [708, 1069, 1445, 1859, 2531] : [97, 135],
    );
    await expect(page.locator(".sector-factor-label")).toHaveText(
      payments === 7612
        ? [
            "Grocery-linked accounts",
            "Grocery-linked accounts",
            "Retail links + Dining links",
            "Subscription-linked accounts",
            "Mixed merchant links",
          ]
        : ["Retail-linked accounts", "Utility-linked accounts"],
    );
    const first = page.locator(".transaction-sector").first();
    await expect(first).toHaveAttribute(
      "title",
      /substantial links for .* accounts; .* versus .* across other sectors/,
    );
    await expect(first).toHaveAttribute(
      "aria-description",
      /distinguishing connection evidence/,
    );
    if (payments === 7612)
      await expect(page.locator(".sector-reference")).toHaveText([
        "Sector 1",
        "Sector 2",
      ]);
    if (payments === 7612) {
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
      await page.screenshot({
        path: "../docs/screenshots/sectors-large-evidence.png",
      });
    }
    // Capture the real API response before Chrome's small inspector cache evicts it.
    const captured = Promise.withResolvers<Run>();
    await page.route("**/api/v1/simulations", async (route) => {
      try {
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        captured.resolve(await response.json());
        await route.fulfill({ response });
      } catch (error) {
        captured.reject(error);
        throw error;
      }
    });
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    const run = await captured.promise;
    expect(run.events).toHaveLength(payments);
    const scenario = run.scenarioSnapshot;
    expect(scenario.nodes).toHaveLength(objects);
    const walmart = scenario.nodes.filter(
      (n) => n.type === "merchant" && n.name === "Walmart",
    );
    expect(walmart).toHaveLength(1);
    expect(walmart[0]).toMatchObject({ category: "other" });
    const purchases = scenario.payments.filter(
      (p) => p.merchantId === walmart[0]!.id,
    );
    expect(new Set(purchases.map((p) => p.category))).toEqual(
      new Set(["retail", "groceries"]),
    );
    expect(purchases.every((p) => p.sourceCategory === p.category)).toBe(true);
    await expect(
      page.getByRole("button", { name: "Edit scenario", exact: true }),
    ).toBeVisible();
  });
}

test("CSV preview maps columns, builds a shared graph and runs the actual engine", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download example CSV" }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe("sample-payments.csv");
  await page.getByLabel("CSV file").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "text/csv",
    buffer: await readFile((await download.path())!),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  const preview = page.getByRole("region", { name: "Import preview" });
  await expect(preview).toContainText(
    "6 objects · 4 relationships · 3 payments",
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await page.screenshot({ path: "../docs/screenshots/csv-preview.png" });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.locator(".node-device")).toHaveCount(1);
  await page.screenshot({ path: "../docs/screenshots/csv-imported-graph.png" });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect CSV03", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toContainText("no alert");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toContainText("No outcome labels");
});

test("CSV errors and cancellation preserve graph; dirty replacement supports cancel and discard", async ({
  page,
}) => {
  await page.locator('.react-flow__node[data-id="account-a"]').focus();
  await page.keyboard.press("ArrowRight");
  const moved = await page
    .locator('.react-flow__node[data-id="account-a"]')
    .getAttribute("style");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "payment_id,timestamp,amount,account_id,merchant_id,device_id,location_id\nP1,2026-10-20T09:00:00Z,-10,A,M,D,L",
    ),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(page.getByRole("alert")).toContainText("Row 2");
  await expect(page.getByRole("button", { name: "Build graph" })).toHaveCount(
    0,
  );
  await expect(
    page.locator('.react-flow__node[data-id="account-a"]'),
  ).toHaveAttribute("style", moved!);
  await page
    .getByLabel("CSV file")
    .setInputFiles("src/assets/sample-payments.csv");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await page.getByRole("button", { name: "Build graph" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await page.locator(".react-flow__node").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "New blank scenario" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("statement import rejects missing model inputs before replacing the graph", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const toggle = await page
    .getByRole("button", { name: "Import CSV", exact: true })
    .boundingBox();
  const popup = await page
    .getByRole("complementary", { name: "CSV import" })
    .boundingBox();
  expect(Math.abs(popup!.x - toggle!.x)).toBeLessThan(2);
  expect(popup!.y).toBeGreaterThan(toggle!.y + toggle!.height);
  await page.getByLabel("CSV file").setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount,Currency\n10/20/2026,Shop,-120,USD\n10/20/2026,Shop,-80,USD\n10/20/2026,Shop,-20,USD\n10/21/2026,Salary,1000,USD",
    ),
  });
  await page.getByLabel("Import purpose").selectOption("model");
  await page.getByText("Columns & format", { exact: true }).click();
  await page.getByLabel("Amount direction").selectOption("negative");
  await page.getByLabel("Date format", { exact: true }).selectOption("mdy");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(page.getByRole("alert")).toContainText("3 of 3 payments");
  await expect(page.getByRole("alert")).toContainText("precise timestamps");
  await expect(page.getByRole("button", { name: "Build graph" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
});

test("object drawer and import dropdown fit desktop and mobile in dark mode", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await expect(
          page.getByRole("button", { name: /Switch to .* mode/ }),
        ).toHaveCount(0);
      await page.getByRole("button", { name: "Objects", exact: true }).click();
      const drawer = page.getByRole("region", { name: "Add objects" });
      await expect(drawer).toBeVisible();
      await expect(
        drawer.getByRole("button", { name: "Add account", exact: true }),
      ).not.toHaveAttribute("draggable", "true");
      await page.screenshot({
        animations: "disabled",
        path: `../docs/screenshots/object-drawer-${width}-${theme}.png`,
      });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("button", { name: "Import CSV", exact: true })
        .click();
      const popup = page.getByRole("complementary", { name: "CSV import" });
      await expect(popup).toBeVisible();
      const bounds = await popup.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        animations: "disabled",
        path: `../docs/screenshots/import-dropdown-${width}-${theme}.png`,
      });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(popup).toHaveCount(0);
    }
  }
});

test("corrupt file bytes preserve the working graph and allow another upload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0xc3, 0x28]),
  });
  await expect(page.getByRole("alert")).toContainText("invalid text bytes");
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await page
    .getByLabel("CSV file")
    .setInputFiles("src/assets/sample-payments.csv");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Preview graph" }),
  ).toBeEnabled();
  await page.getByText("Columns & format", { exact: true }).click();
  await expect(page.getByLabel("Amount direction")).toBeVisible();
  await page.getByLabel("CSV file").setInputFiles({
    name: "replacement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("timestamp,amount,merchant_name\n2026-10-20,10,Shop"),
  });
  await expect(
    page.getByRole("button", { name: "Preview graph" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Amount direction")).toBeHidden();
});
