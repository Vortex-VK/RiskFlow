import { fillModelInputs, connectOnCanvas } from "./workspace-helpers";
import { openExampleWorkspace } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const details = (page: Page) =>
  page.getByRole("complementary", { name: "Selection details" });
const node = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(node(page, "account-a")).toBeVisible();
});

test("opening, dark mode, drag, cancellation, keyboard movement and undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(details(page)).toHaveCount(0);
  await page.screenshot({
    path: "../docs/screenshots/editor-opening-1440.png",
  });
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const fill = await node(page, "account-a")
    .locator(".node-body")
    .evaluate((element) => getComputedStyle(element).fill);
  expect(fill).toBe("rgb(125, 155, 178)");
  const body = node(page, "account-a").locator(".node-body");
  const original = await body.getAttribute("d");
  const box = await node(page, "account-a").boundingBox();
  if (!box) throw new Error("Missing object");
  const start = { x: box.x + 50, y: box.y + 50 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let index = 1; index <= 6; index++) {
    await page.mouse.move(start.x + index * 17, start.y + index * 5);
    await page.waitForTimeout(18);
  }
  expect(await body.getAttribute("d")).not.toBe(original);
  await page.screenshot({ path: "../docs/screenshots/editor-drag-dark.png" });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  const moved = await node(page, "account-a").boundingBox();
  expect(moved!.x).toBeGreaterThan(box.x + 75);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await node(page, "account-a").boundingBox())!.x)
    .toBeCloseTo(box.x, 0);
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  await expect(details(page)).toBeVisible();
  await node(page, "account-a").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 100, start.y + 20, { steps: 7 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect
    .poll(async () => (await node(page, "account-a").boundingBox())!.x)
    .toBeCloseTo(box.x, 0);
  expect(errors).toEqual([]);
});

test("payment validation, unapplied buffers, explicit labels and history", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H10", exact: true }).click();
  const panel = details(page);
  await panel.getByLabel("Amount · USD").fill("1e3");
  await expect(
    page.getByText("Unapplied edits", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("positive USD");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("positive USD");
  await expect(
    page.getByRole("main", { name: "RiskFlow graph workspace" }),
  ).toBeVisible();
  await panel.getByLabel("Amount · USD").fill("123.45");
  await expect(
    panel.getByText("1 affected labeled payment", { exact: false }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "$123.45" })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(panel.getByLabel("Amount · USD")).not.toHaveValue("123.45");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(panel.getByLabel("Amount · USD")).toHaveValue("123.45");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.screenshot({
    path: "../docs/screenshots/editor-payment-1440.png",
  });
});

test("cascade deletion asks once and undo restores the full context", async ({
  page,
}) => {
  await node(page, "device-shared").click();
  let confirmations = 0;
  page.on("dialog", (dialog) => {
    confirmations++;
    expect(dialog.message()).toContain("dependent payment");
    void dialog.accept();
  });
  await details(page)
    .getByRole("button", { name: "Delete device", exact: true })
    .click();
  await expect(node(page, "device-shared")).toHaveCount(0);
  expect(confirmations).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(node(page, "device-shared")).toBeVisible();
  await expect(page.getByRole("button", { name: "Payments 16" })).toBeVisible();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit scenario" }).click();
});

test("blank scenario can be built through keyboard-accessible forms and independent duplicate payments", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "New blank scenario" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByRole("button", { name: "Place at center" }).click();
  await details(page).getByLabel("Name", { exact: true }).fill("Test account");
  await details(page)
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(details(page)).toHaveCount(0);
  await page.locator(".react-flow__node").first().focus();
  await page.keyboard.press("Enter");
  await expect(details(page).getByLabel("Name", { exact: true })).toHaveValue(
    "Test account",
  );
  await details(page)
    .getByRole("button", { name: "Create starter context" })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(
    details(page).getByRole("button", { name: "Device & location connected" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add merchant", exact: true }).click();
  await page.getByRole("button", { name: "Place at center" }).click();
  const accountId = await page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-account") })
    .getAttribute("data-id");
  const merchantId = await page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-merchant") })
    .getAttribute("data-id");
  await connectOnCanvas(page, accountId!, merchantId!);
  await fillModelInputs(page);
  await details(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Payments 1" })).toBeVisible();
  await details(page).getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  const group = page
    .locator(".react-flow__edge")
    .filter({ has: page.locator("text") });
  await page.locator(".react-flow__edge").last().focus();
  await page.keyboard.press("Enter");
  await details(page)
    .getByRole("button", { name: "Add another payment" })
    .click();
  await fillModelInputs(page);
  await details(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Payments 2" })).toBeVisible();
  await expect(group).toHaveCount(1);
  await details(page)
    .getByRole("button", { name: "Delete payment", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Payments 1" })).toBeVisible();
});

test("mobile containment and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H10", exact: true }).click();
  const box = await details(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "../docs/screenshots/editor-mobile-390.png" });
  await details(page).getByRole("button", { name: "Close details" }).click();
  const body = node(page, "account-a").locator(".node-body");
  const original = await body.getAttribute("d");
  const nodeBox = await node(page, "account-a").boundingBox();
  await page.mouse.move(
    nodeBox!.x + nodeBox!.width / 2,
    nodeBox!.y + nodeBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    nodeBox!.x + nodeBox!.width / 2 + 30,
    nodeBox!.y + nodeBox!.height / 2 + 20,
    { steps: 7 },
  );
  expect(await body.getAttribute("d")).toBe(original);
  await page.mouse.up();
});

test("selected objects have no connection dots; click connection and label edits preserve facts", async ({
  page,
}) => {
  const a = node(page, "account-a");
  await a.focus();
  await page.keyboard.press("Enter");
  await expect(a.locator(".source")).toBeHidden();
  await expect(a.locator(".target")).toBeHidden();
  await a.focus();
  await page.keyboard.press("c");
  await expect(node(page, "account-b").locator(".node-compatible")).toHaveCount(
    0,
  );
  await node(page, "grocery").locator(".node-hit").click();
  await details(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Payments 16" })).toBeVisible();
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H09", exact: true }).click();
  await details(page)
    .getByRole("combobox", { name: "Device", exact: true })
    .selectOption("device-c");
  await details(page)
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  const request = page.waitForRequest((r) => r.url().endsWith("/simulations"));
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const submitted = (await request).postDataJSON().scenario;
  expect(
    submitted.payments.find((p: { id: string }) => p.id === "H09").deviceId,
  ).toBe("device-c");
  expect(submitted.groundTruth.H09).toBe("fraudulent");
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H09", exact: true }).click();
  await details(page)
    .getByRole("textbox", { name: /Amount/ })
    .fill("111.00");
  await details(page)
    .getByRole("combobox", { name: /affected labeled payment/ })
    .selectOption("clear");
  await details(page)
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  const cleared = page.waitForRequest((r) => r.url().endsWith("/simulations"));
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  expect(
    (await cleared).postDataJSON().scenario.groundTruth.H09,
  ).toBeUndefined();
});

test("accessible opening and payment form in dark mode", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["dark"]) {
    if (theme === "dark")
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
    const opening = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(opening.violations).toEqual([]);
    await page.getByRole("button", { name: "Payments 16" }).click();
    await page
      .getByRole("button", { name: "Payment H10", exact: true })
      .click();
    const editor = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(editor.violations).toEqual([]);
    await details(page).getByRole("button", { name: "Close details" }).click();
  }
});
