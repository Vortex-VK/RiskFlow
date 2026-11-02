import { fillModelInputs } from "./workspace-helpers";
import { openExampleWorkspace, selectExample } from "./workspace-helpers";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
});

test("blank construction, unlabeled simulation and policy editing", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "New blank scenario" }).click();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page
    .locator(".react-flow__pane")
    .click({ position: { x: 340, y: 390 } });
  const inspector = page.getByRole("complementary", {
    name: "Selection details",
  });
  await inspector
    .getByRole("button", { name: "Create starter context" })
    .click();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page
    .getByRole("button", { name: "Add merchant", exact: true })
    .dragTo(page.locator(".react-flow__pane"), {
      targetPosition: { x: 650, y: 420 },
    });
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-merchant") })
    .focus();
  await page.keyboard.press("c");
  await expect(page.locator(".node-compatible")).toHaveCount(1);
  await page.locator(".react-flow__node .node-account .node-hit").click();
  await fillModelInputs(page);
  await inspector.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toContainText("No outcome labels");
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "Policy & costs" }).click();
  await page.getByLabel("Cost per review · USD").fill("0.00");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare runs" })).toHaveCount(
    0,
  );
});

test("session-only workspace removes the legacy draft and never stores new data", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("riskflow:v1:scenario", "legacy draft");
    localStorage.setItem("unrelated-setting", "keep");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Payments 0" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await selectExample(page);
  expect(
    await page.evaluate(() => localStorage.getItem("riskflow:v1:scenario")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("unrelated-setting")),
  ).toBe("keep");
  await page.locator('.react-flow__node[data-id="account-a"]').focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Name", { exact: true }).fill("Session name");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("riskflow:v1:scenario")),
  ).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "Payments 0" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Last run" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
});

test("adding an object is independently undoable and placement cancellation does not edit", async ({
  page,
}) => {
  await page.locator('.react-flow__node[data-id="account-a"]').focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Duplicate object" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByRole("button", { name: "Place at center" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(16);
  await expect(page.locator(".react-flow__edge")).toHaveCount(21);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "New account",
  );
  await expect(
    page.locator('[data-node="account-a"] .node-material text'),
  ).toHaveText("A");
  await expect(
    page.locator(".react-flow__node").last().locator(".node-material text"),
  ).toHaveText("N");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(
    page.locator('[data-node="account-a"] .node-material text'),
  ).toHaveText("A");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add device", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Canvas action" })).toHaveCount(
    0,
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeEnabled();
  await page.locator('.react-flow__node[data-id="account-b"]').focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Name", { exact: true }).fill("Alice Chen");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.locator('[data-node="account-a"] .node-material text'),
  ).toHaveText("A1");
  await expect(
    page.locator('[data-node="account-b"] .node-material text'),
  ).toHaveText("A2");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.locator('[data-node="account-b"] .node-material text'),
  ).toHaveText("B");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-node="account-a"] .node-material text'),
  ).toHaveText("A1");
  await expect(
    page.locator('[data-node="account-b"] .node-material text'),
  ).toHaveText("A2");
});
