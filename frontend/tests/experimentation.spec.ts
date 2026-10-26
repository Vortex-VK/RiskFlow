import { fillModelInputs } from "./workspace-helpers";
import { openExampleWorkspace, selectExample } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import type { Document } from "../src/domain/types";
import type { Run } from "../src/domain/runs";
import { compareRuns, rateDifference } from "../src/domain/comparison";

test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
});

test("blank construction, unlabeled simulation and policy editing", async ({
  page,
}) => {
  await page.getByRole("button", { name: "About this workspace" }).click();
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
  ).toContainText("Truth metrics: N/A");
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "Policy & costs" }).click();
  await page.getByLabel("Cost per review · USD").fill("0.00");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Compare runs" }).click();
  await expect(
    page.getByRole("complementary", { name: "Comparison details" }),
  ).toContainText("Cost assumptions changed");
});

test("comparison distinguishes labels, population, versions, null rates and other-account history", async ({
  request,
}) => {
  const doc: Document = await (
    await request.get("/api/v1/templates/shared-device-cluster")
  ).json();
  for (const node of doc.scenario.nodes)
    if (node.type === "account") node.usualCountryCodes.push("CA");
  const run = async (): Promise<Run> => {
    const response = await request.post("/api/v1/simulations", {
      data: { scenario: doc.scenario },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const first = await run();
  const reordered = structuredClone(first);
  for (const node of reordered.scenarioSnapshot.nodes) {
    if (node.type !== "account") continue;
    node.usualCountryCodes.reverse();
    node.usualMerchantCategories.reverse();
  }
  for (const payment of reordered.scenarioSnapshot.payments)
    payment.unavailableRules = [];
  const unchanged = compareRuns(first, reordered);
  expect(unchanged.basis).toEqual(["Same analytical inputs"]);
  expect(unchanged.events).toHaveLength(first.events.length);
  for (const event of unchanged.events) {
    expect(event.reasons).toEqual([]);
    expect(event.changed).toBe(false);
  }
  doc.scenario.payments.find((p) => p.id === "H09")!.deviceId = "device-c";
  const second = await run();
  expect(
    compareRuns(first, second).events.find((e) => e.id === "H10")!.reasons,
  ).toEqual(["Earlier payment history changed"]);
  doc.scenario.groundTruth.H10 = "legitimate";
  const relabeled = await run();
  expect(compareRuns(second, relabeled)).toMatchObject({
    labelsChanged: true,
    coverageChanged: false,
    populationChanged: false,
  });
  delete doc.scenario.groundTruth.H01;
  const partial = await run();
  expect(compareRuns(relabeled, partial).coverageChanged).toBe(true);
  doc.scenario.payments = doc.scenario.payments.filter((p) => p.id !== "H01");
  const removed = await run();
  expect(compareRuns(partial, removed)).toMatchObject({
    removed: 1,
    added: 0,
    populationChanged: true,
  });
  expect(compareRuns(removed, partial).added).toBe(1);
  const versioned = structuredClone(removed);
  versioned.engineVersion = "engine-test";
  expect(compareRuns(removed, versioned).basis).toContain(
    "Engine/rules changed",
  );
  expect(rateDifference(null, { numerator: 1, denominator: 2 })).toBeNull();
  expect(
    rateDifference(
      { numerator: 0, denominator: 0 },
      { numerator: 1, denominator: 2 },
    ),
  ).toBeNull();
  expect(
    rateDifference(
      { numerator: 1, denominator: 4 },
      { numerator: 1, denominator: 2 },
    ),
  ).toBe(25);
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
