import { setPlaybackPosition } from "./workspace-helpers";
import { fillModelInputs, connectOnCanvas } from "./workspace-helpers";
import {
  openExampleWorkspace,
  selectExample,
  setPlaybackSpeed,
} from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Document } from "../src/domain/types";

const errors = new WeakMap<Page, string[]>();
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Selection details" });
const selectNode = async (page: Page, id: string) => {
  await page.locator(`.react-flow__node[data-id="${id}"]`).focus();
  await page.keyboard.press("Enter");
};
const options = async (page: Page) => {
  await button(page, "About this workspace").click();
  await page.getByText("Scenario options", { exact: true }).click();
};
const expandDetails = async (root: Locator) => {
  const sections = root.locator("details");
  for (let i = 0; i < (await sections.count()); i++) {
    const section = sections.nth(i);
    if (
      !(await section.evaluate(
        (element) => (element as HTMLDetailsElement).open,
      ))
    )
      await section.locator(":scope > summary").click();
    await expect(section).toHaveAttribute("open", "");
  }
};

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
  await openExampleWorkspace(page);
  await expect(button(page, "Simulate")).toBeEnabled();
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await info.attach("qa-screen", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  expect(errors.get(page), "Uncaught browser exceptions").toEqual([]);
});

test("selecting an object or payment replaces a clean policy panel", async ({
  page,
}) => {
  await options(page);
  await button(page, "Policy & costs").click();
  await selectNode(page, "account-b");
  await expect(inspector(page)).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Policy and costs" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Blair Chen",
  );
  await selectNode(page, "grocery");
  await expect(
    page.getByRole("complementary", { name: "Connect objects" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Juniper Market",
  );
  await button(page, "Close details").click();
  await options(page);
  await button(page, "Policy & costs").click();
  await button(page, "Payments 16").click();
  await button(page, "Payment H10").click();
  await expect(page.getByLabel("Amount · USD")).toHaveValue("240.00");
  await expect(
    page.getByRole("complementary", { name: "Policy and costs" }),
  ).toHaveCount(0);
});

test("invalid required fields are revealed even after collapsing their section", async ({
  page,
}) => {
  await selectNode(page, "account-a");
  await page.getByText("Account baseline", { exact: true }).click();
  await page.getByLabel("Opened · UTC").fill("");
  await page.getByText("Account baseline", { exact: true }).click();
  await button(page, "Apply").click();
  await expect(page.getByLabel("Opened · UTC")).toBeVisible();
  await expect(page.getByLabel("Opened · UTC")).toBeFocused();
  await button(page, "Cancel").click();
  await expect(inspector(page)).toHaveCount(0);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("Escape dismisses import with a focused field and cancels policy edits", async ({
  page,
}) => {
  await button(page, "Import CSV").click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "qa.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount\n2026-10-20,12"),
  });
  await page.getByLabel("Scenario name").focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "CSV import" }),
  ).toHaveCount(0);
  await options(page);
  await button(page, "Policy & costs").click();
  const threshold = page.getByLabel("Cost per review · USD", { exact: true });
  await threshold.fill("65");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Policy and costs" }),
  ).toHaveCount(0);
  await expect(button(page, "Undo")).toBeDisabled();
  await options(page);
  await button(page, "Policy & costs").click();
  await expect(threshold).toHaveValue("3.00");
  await button(page, "Cancel").click();
});

test("Escape closes each replay detail panel", async ({ page }) => {
  await button(page, "Simulate").click();
  await button(page, "Inspect payments").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Run events" })).toHaveCount(0);
  await button(page, "Results").click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toHaveCount(0);
  await button(page, "Inspect payments").click();
  await button(page, "Inspect H10").click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toHaveCount(0);
  await selectNode(page, "device-shared");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Snapshot object details" }),
  ).toHaveCount(0);
});

for (const templateId of [
  "shared-device-cluster",
  "everyday-purchases",
  "stolen-card-burst",
  "account-takeover",
]) {
  test(`all event decisions and result disclosures in ${templateId}`, async ({
    page,
  }) => {
    const fixture = JSON.parse(
      await readFile(`../fixtures/scenarios/${templateId}.json`, "utf8"),
    ) as Document;
    const expected = JSON.parse(
      await readFile(
        `../fixtures/runtime/${templateId}-upload-v9.json`,
        "utf8",
      ),
    ) as {
      events: {
        eventId: string;
        model: { alert: boolean };
        decision: string;
      }[];
    };
    await options(page);
    await page
      .getByRole("button", { name: new RegExp(`^${fixture.scenario.name}`) })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(
      fixture.scenario.nodes.length,
    );
    await button(page, "Simulate").click();
    await setPlaybackPosition(page, -1);
    await setPlaybackPosition(page, 0);
    await setPlaybackPosition(page, -1);
    await expect(page.getByRole("status")).toContainText(
      `0/${expected.events.length} revealed`,
    );
    for (const event of expected.events) {
      await button(page, "Inspect payments").click();
      await button(page, `Inspect ${event.eventId}`).click();
      const panel = page.getByRole("complementary", {
        name: "Payment explanation",
      });
      await expect(panel.locator(".decision")).toContainText(
        `${event.model.alert ? "review" : "no alert"}`,
      );
      if (event === expected.events[expected.events.length - 1]) {
        await expandDetails(panel);
        const highlights = panel.getByRole("button", {
          name: "Highlight evidence",
          exact: true,
        });
        for (let i = 0; i < (await highlights.count()); i++)
          await highlights.nth(i).click();
        const focus = panel.getByRole("button", {
          name: "Focus evidence",
          exact: true,
        });
        for (let i = 0; i < (await focus.count()); i++)
          await focus.nth(i).click();
      }
    }
    await button(page, "Close explanation").click();
    await button(page, "Inspect payments").click();
    await button(page, "Close events").click();
    await button(page, "Play again").click();
    await button(page, "Pause").click();
    await button(page, "Play").click();
    await button(page, "Pause").click();
    for (const speed of [0.1, 0.25, 0.5, 1, 2, 5, 10])
      await setPlaybackSpeed(page, speed);
    await button(page, "Fit").click();
    await button(page, "Results").click();
    const totals = page.getByRole("complementary", {
      name: "Completed run totals",
    });
    await expandDetails(totals);
    await expect(totals).toContainText(`${expected.events.length} payments`);
    await expect(
      page.getByRole("button", { name: /Switch to .* mode/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: `../docs/screenshots/qa-${templateId}.png` });
    await expect(
      page.getByRole("button", { name: /Switch to .* mode/ }),
    ).toHaveCount(0);
    await button(page, "Close results").click();
    await button(page, "Edit scenario").click();
    await button(page, "Last run").click();
    await expect(
      page.getByRole("main", { name: "RiskFlow run snapshot" }),
    ).toBeVisible();
  });
}

test("all node editors, camera controls, and dirty edit guards work", async ({
  page,
}) => {
  const view = page.locator(".react-flow__viewport");
  const before = await view.getAttribute("style");
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, -100);
  await expect(view).not.toHaveAttribute("style", before!);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 100);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 160);
  for (const [id, field, value] of [
    ["account-a", "Typical purchase · USD", "75.25"],
    ["grocery", "Country · ISO code", "CA"],
    ["device-shared", "Description", "QA shared device"],
    ["location-a", "Region", "QA Brooklyn"],
  ]) {
    await selectNode(page, id!);
    if (id === "account-a")
      await page.getByText("Account baseline", { exact: true }).click();
    await page.getByLabel(field!, { exact: true }).fill(value!);
    await expect(button(page, "Undo")).toBeDisabled();
    await selectNode(page, "account-c");
    await expect(page.getByRole("status")).toContainText("Apply or cancel");
    await expect(page.getByLabel(field!, { exact: true })).toHaveValue(value!);
    await button(page, "Apply").click();
    await expect(inspector(page)).toHaveCount(0);
    await button(page, "Undo").click();
    await button(page, "Redo").click();
  }
  await selectNode(page, "grocery");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("travel");
  await page.getByLabel("Country · ISO code").fill("XX");
  await button(page, "Apply").click();
  await expect(inspector(page).getByRole("alert")).toContainText("supported");
  await page.getByLabel("Country · ISO code").fill("US");
  await button(page, "Apply").click();
  await expect(inspector(page)).toHaveCount(0);
  await selectNode(page, "grocery");
  await page.getByText("3 related payments · UTC", { exact: true }).click();
  await inspector(page).getByRole("button").filter({ hasText: "H01" }).click();
  await expect(page.getByLabel("Amount · USD")).toBeVisible();
  await page.getByText("Endpoints & synthetic label", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Synthetic label", exact: true })
    .selectOption("");
  await button(page, "Apply").click();
  await button(page, "Cancel").click();
  await options(page);
  await button(page, "Reset to template").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button(page, "Reset to template").click();
  await button(page, "Discard").click();
  await expect(button(page, "Undo")).toBeDisabled();
});

test("context form, grouped payment creation and removal preserve independent events", async ({
  page,
}) => {
  await connectOnCanvas(page, "account-a", "device-shared");
  await expect(page.getByLabel("First observed · UTC")).toBeVisible();
  await button(page, "Close details").click();
  await connectOnCanvas(page, "account-a", "device-b");
  await page.getByLabel("First observed · UTC").fill("2026-01-15T00:00");
  await page.getByLabel("Familiar since · UTC").fill("2025-01-15T00:00");
  await button(page, "Add").click();
  await expect(page.getByRole("alert")).toContainText("before observation");
  await page.getByLabel("Familiar since · UTC").fill("");
  await button(page, "Add").click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(22);
  await button(page, "Delete association").click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(21);
  const group = page.locator('.react-flow__edge[data-id="account-a:grocery"]');
  await group.focus();
  await page.keyboard.press("Enter");
  await button(page, "Add another payment").click();
  await page.getByLabel("Amount · USD").fill("12.34");
  await fillModelInputs(page);
  await button(page, "Add").click();
  await expect(button(page, "Payments 17")).toBeVisible();
  await button(page, "Delete payment").click();
  await expect(button(page, "Payments 16")).toBeVisible();
  await group.focus();
  await page.keyboard.press("Enter");
  const remove = inspector(page).getByRole("button", { name: /^Remove all/ });
  const before = await page.locator(".react-flow__edge").count();
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(before);
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(before - 1);
  await button(page, "Undo").click();
  await expect(button(page, "Payments 16")).toBeVisible();
});

test("CSV formatting, mappings, assumptions and preview invalidation remain usable", async ({
  page,
}) => {
  await button(page, "Import CSV").click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "europe.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "When;Clock;Cost;Payee;Currency;channel;mcc;status\n20/10/2026;09:30;12,34;Cafe;USD;Chip Transaction;5812;completed\n21/10/2026;10:45;56,78;Shop;USD;Chip Transaction;5399;completed",
    ),
  });
  await page.getByText("Columns & format", { exact: true }).click();
  await page
    .getByLabel("Column for timestamp", { exact: true })
    .selectOption("When");
  await page
    .getByLabel("Column for time", { exact: true })
    .selectOption("Clock");
  await page
    .getByLabel("Column for amount", { exact: true })
    .selectOption("Cost");
  await page
    .getByLabel("Column for merchant_name", { exact: true })
    .selectOption("Payee");
  await page.getByLabel("Date format", { exact: true }).selectOption("dmy");
  await page
    .getByLabel("Decimal format", { exact: true })
    .selectOption("comma");
  await page
    .getByLabel("UTC offset for times without a timezone")
    .fill("+02:00");
  await page.getByText("Identity & context columns", { exact: true }).click();
  await page
    .getByText("Assumptions for missing metadata", { exact: true })
    .click();
  await page
    .getByLabel("Account name for a single-account statement")
    .fill("QA account");
  await page
    .getByRole("checkbox", {
      name: "Apply the display assumptions below",
    })
    .check();
  await page.getByLabel("Typical purchase · USD").fill("100.00");
  await button(page, "Preview graph").click();
  const preview = page.getByRole("region", { name: "Import preview" });
  await expect(preview).toContainText("$12.34");
  await expect(preview).toContainText("2026-10-20T07:30:00");
  await page
    .getByText("Objects in the imported graph", { exact: true })
    .click();
  await expect(preview).toContainText("QA account");
  await page.getByLabel("Scenario name").fill("QA import");
  await expect(preview).toHaveCount(0);
  await expect(button(page, "Preview graph")).toBeEnabled();
  await button(page, "Preview graph").click();
  await button(page, "Build graph").click();
  await expect(button(page, "Payments 2")).toBeVisible();
  await button(page, "Simulate").click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
});

test("service failure retry and failed rerun preserve usable state", async ({
  page,
}) => {
  await page.route("**/api/v1/templates/shared-device-cluster", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.reload();
  await expect(button(page, "Payments 0")).toBeVisible();
  await options(page);
  await page.getByRole("button", { name: /^Shared Device Cluster/ }).click();
  await expect(page.getByRole("status")).toContainText("503");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.unroute("**/api/v1/templates/shared-device-cluster");
  await button(page, "About this workspace").click();
  await selectExample(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await button(page, "Simulate").click();
  await button(page, "Edit scenario").click();
  await page.route("**/api/v1/simulations", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await button(page, "Simulate").click();
  await expect(page.getByRole("status")).toContainText("503");
  await button(page, "Last run").click();
  await button(page, "Results").click();
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toContainText("16 payments");
});

test("small-screen import, policy and connection panels remain operable in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark"]) {
    if (theme === "dark")
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
    await button(page, "Import CSV").click();
    await expect(page.getByLabel("CSV file")).toBeAttached();
    await expect(
      page.getByRole("complementary", { name: "CSV import" }),
    ).toHaveCSS("opacity", "1");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `../docs/screenshots/qa-mobile-import-${theme}.png`,
    });
    await button(page, "Close CSV import").click();
    await options(page);
    await button(page, "Policy & costs").click();
    await page.getByLabel("Cost per false block · USD").fill("20.00");
    await page.getByLabel("Approved fraud loss · percent").fill("75");
    await button(page, "Apply").click();
    await selectNode(page, "account-a");
    await connectOnCanvas(page, "account-a", "grocery");
    await page.getByLabel("Amount · USD").focus();
    await page.keyboard.press("Escape");
    await expect(inspector(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  }
});
