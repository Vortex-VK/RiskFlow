import { useCommonCutoff } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { syntheticModelCsv, setPlaybackSpeed } from "./workspace-helpers";
function csvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift()!;
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])),
  );
}

test("subtle sector links reveal exact source payments without crowding the overview", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const csv = new Map(
    csvRows(
      await readFile("../fixtures/imports/transactions-synthetic.csv", "utf8"),
    ).map((r) => [r.transaction_id, r]),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions-synthetic.csv",
    mimeType: "text/csv",
    buffer: await syntheticModelCsv(
      "../fixtures/imports/transactions-synthetic.csv",
    ),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await expect(
    page.getByRole("region", { name: "Connection evidence" }),
  ).toHaveCount(0);
  const shown = await page.locator(".connection-target").count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(Math.ceil(5 * 1.2));
  const outlines = await page
    .locator(".territory-hit")
    .evaluateAll((paths) => paths.map((p) => getComputedStyle(p).stroke));
  expect(outlines).toHaveLength(5);
  expect(outlines.every((s) => s === "none")).toBe(true);
  const firstLink = page.locator(".connection-target").first();
  const midpoint = await firstLink.evaluate((element) => {
    const path = element as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.move(midpoint.x, midpoint.y);
  const hovered = page.locator(".connection-control:hover .connection-hover");
  await expect(hovered).toHaveCount(1);
  await expect(hovered).toHaveCSS("opacity", "0.8");
  expect(
    await hovered.evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0.18s");
  const widths = await hovered.evaluate((e) => ({
    visible: parseFloat(getComputedStyle(e).strokeWidth),
    hit: parseFloat(getComputedStyle(e.previousElementSibling!).strokeWidth),
  }));
  expect(widths.visible / widths.hit).toBeCloseTo(0.1);
  await expect(
    page.getByRole("region", { name: "Connection evidence" }),
  ).toHaveCount(0);
  await page.mouse.move(10, 10);
  await page.mouse.click(midpoint.x, midpoint.y);
  await expect(page.locator(".connection-target:focus")).toHaveCSS(
    "outline-style",
    "none",
  );
  const panel = page.getByRole("region", { name: "Connection evidence" });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "View flagged payments", exact: true }),
  ).toHaveCount(0);
  await expect(panel).toContainText("Run a simulation to see review decisions");
  await expect(
    panel.getByText("Browse connections", { exact: true }),
  ).toHaveCount(0);
  const entity = panel.getByRole("combobox", { name: "Shared object" });
  const value = await entity.inputValue();
  await expect(page.locator(".atlas-cloud")).toHaveAttribute(
    "data-highlighted-entity",
    value,
  );
  const text = await entity.locator("option:checked").textContent();
  const match = text!.match(/^(.*) \((merchant|account|device)\)$/)!;
  const field = {
    merchant: "merchant_name",
    account: "account_id",
    device: "device_id",
  }[match[2]!]!;
  const ids = await panel.locator(".connection-payment-id").allTextContents();
  expect(ids.length).toBeGreaterThan(1);
  for (const id of ids) {
    expect(csv.has(id)).toBe(true);
    expect(csv.get(id)![field]).toBe(match[1]);
  }
  await page.screenshot({
    path: testInfo.outputPath("shared-connection.png"),
  });
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Connections/ })).toHaveCount(
    0,
  );
  await page.locator(".connection-target").first().press("Enter");
  const payment = panel.locator(".connection-payments button").first();
  const id = await payment.locator(".connection-payment-id").textContent();
  await payment.click();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-detail",
    "true",
  );
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const inspector = page.getByRole("complementary", {
    name: "Selection details",
  });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByLabel("Amount \u00b7 USD")).toHaveValue(
    Number(csv.get(id!)!.amount).toFixed(2),
  );
  const time = await inspector
    .getByLabel("Payment time \u00b7 UTC")
    .inputValue();
  expect(new Date(`${time}Z`).toISOString()).toBe(
    new Date(csv.get(id!)!.timestamp!).toISOString(),
  );
  expect(errors).toEqual([]);
});

test("shared connections follow playback and threshold, and open the real payment explanation", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page
    .getByRole("button", { name: "Open in workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset playback", exact: true })
    .click();
  const threshold = page.getByRole("slider", {
    name: /^Probability threshold/,
  });
  await useCommonCutoff(page);
  await threshold.press("Home");
  await page.locator(".connection-target").first().press("Enter");
  const panel = page.getByRole("region", {
    name: "Connection evidence",
    exact: true,
  });
  const totals = panel.locator(".connection-summary strong");
  await expect(panel).toBeVisible();
  const counts = await totals.allTextContents();
  const total = counts[1]!;
  expect(Number(total.replaceAll(",", ""))).toBeGreaterThan(0);
  expect(counts[2]).toBe("0");
  await expect(
    panel.getByRole("button", { name: "View flagged payments", exact: true }),
  ).toHaveCount(0);
  await expect(panel.locator(".connection-payment-status").first()).toHaveText(
    "Not yet assessed",
  );
  await setPlaybackSpeed(page, 10);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Run complete", {
    timeout: 30000,
  });
  await expect(totals).toHaveText([counts[0]!, total, total]);
  await expect(panel.locator(".connection-filters button")).toHaveText([
    "View all payments",
    "View flagged payments",
  ]);
  await panel
    .getByRole("button", { name: "View flagged payments", exact: true })
    .click();
  await expect(
    panel.locator(".connection-payment-heading .connection-flag").first(),
  ).toHaveText("Flagged");
  await useCommonCutoff(page);
  await threshold.press("End");
  await expect(totals).toHaveText([counts[0]!, total, "0"]);
  await expect(
    panel.getByRole("button", { name: "View flagged payments", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "View all payments", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await panel
    .getByRole("button", { name: "View all payments", exact: true })
    .click();
  await expect(panel.locator(".connection-payment-status").first()).toHaveText(
    "No alert",
  );
  await useCommonCutoff(page);
  await threshold.press("Home");
  await panel
    .getByRole("button", { name: "View flagged payments", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await panel.screenshot({
    path: testInfo.outputPath("shared-connection-review.png"),
  });
  const payment = panel.locator(".connection-payment").first();
  const id = await payment.getAttribute("data-payment-id");
  const overview = page.getByRole("region", { name: "Run assessment summary" });
  const before = await overview.locator("strong").allTextContents();
  await payment.click();
  const detail = page.getByRole("complementary", {
    name: "Payment explanation",
    exact: true,
  });
  await expect(detail).toContainText(id!);
  await expect(panel).toHaveCount(0);
  await expect(overview.locator("strong")).toHaveText(before);
  await expect(
    detail.getByRole("region", { name: "Model explanation", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
