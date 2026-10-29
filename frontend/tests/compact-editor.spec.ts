import { expect, test, type Page } from "@playwright/test";
import { connectOnCanvas, openExampleWorkspace } from "./workspace-helpers";
import type { Scenario } from "../src/domain/types";

const details = (page: Page) =>
  page.getByRole("complementary", { name: "Selection details" });
async function selectNode(page: Page, id: string) {
  await page.locator(`.react-flow__node[data-id="${id}"]`).focus();
  await page.keyboard.press("Enter");
}

test("starter context sits below the name and saves name plus context in one undoable action", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByRole("button", { name: "Place at center" }).click();
  const starter = page.getByRole("button", { name: "Create starter context" });
  expect(
    await starter.evaluate(
      (el) =>
        el.previousElementSibling?.querySelector('input[name="name"]') !== null,
    ),
  ).toBe(true);
  await expect(
    details(page).getByRole("button", { name: /Connect|Duplicate/ }),
  ).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("");
  await starter.click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByLabel("Name", { exact: true }).fill("Simple account");
  await starter.click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Simple account",
  );
  await expect(
    page.getByRole("button", { name: "Device & location connected" }),
  ).toBeDisabled();
  await page.locator(".react-flow__node").first().focus();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "New account",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByLabel("Name", { exact: true }).fill("Saved with Enter");
  await page.getByLabel("Name", { exact: true }).press("Enter");
  await expect(details(page)).toHaveCount(0);
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Saved with Enter" }),
  ).toHaveCount(1);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Add merchant", exact: true }).click();
  await page.getByRole("button", { name: "Place at center" }).click();
  await expect(
    details(page).getByRole("button", {
      name: /Connect|Duplicate|starter context/,
    }),
  ).toHaveCount(0);
});

test("close discards dirty object, transaction and context drafts and leaves menus usable", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  for (const id of ["account-a", "grocery", "device-a", "location-home"]) {
    // Use the actual location id from the canvas below when the fixture differs.
    const target =
      id === "location-home"
        ? (await page
            .locator(".react-flow__node")
            .filter({ has: page.locator(".node-location") })
            .first()
            .getAttribute("data-id"))!
        : id;
    await selectNode(page, target);
    const original = await page
      .getByLabel("Name", { exact: true })
      .inputValue();
    await page.getByLabel("Name", { exact: true }).fill("Discard this");
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(details(page)).toHaveCount(0);
    await selectNode(page, target);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      original,
    );
    await page.getByRole("button", { name: "Close details" }).click();
  }
  await connectOnCanvas(page, "account-a", "grocery");
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(details(page)).toHaveCount(0);
  await connectOnCanvas(page, "account-a", "grocery");
  await page.getByLabel("Amount · USD").fill("12.34");
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(details(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
  await connectOnCanvas(page, "account-a", "device-b");
  await page.getByLabel("Familiar since · UTC").fill("2026-01-15T01:00");
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(details(page)).toHaveCount(0);
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "Policy & costs" }).click();
  const cost = await page.getByLabel("Cost per review · USD").inputValue();
  await page.getByLabel("Cost per review · USD").fill("999.00");
  await page.getByRole("button", { name: "Close policy and costs" }).click();
  await expect(
    page.getByRole("complementary", { name: "Policy and costs" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: "Policy & costs" }).click();
  await expect(page.getByLabel("Cost per review · USD")).toHaveValue(cost);
});

test("blank additional information gets defaults while supplied values and failed status survive", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await connectOnCanvas(page, "account-a", "grocery");
  const additional = details(page)
    .locator("details")
    .filter({ has: page.getByText("Additional information", { exact: true }) });
  await expect(additional).not.toHaveAttribute("open");
  await expect(
    page.getByRole("combobox", { name: "Transaction channel", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Payments 17", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await connectOnCanvas(page, "account-a", "grocery");
  await page.getByLabel("Amount · USD").fill("12.34");
  await page.getByText("Additional information", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Transaction channel", exact: true })
    .selectOption("Online Transaction");
  await page
    .getByRole("combobox", { name: "Payment category", exact: true })
    .selectOption("electronics");
  await page
    .getByRole("combobox", { name: "Completion status", exact: true })
    .selectOption("false");
  await page.getByLabel("Merchant category code (four digits)").fill("bad");
  await page.getByText("Additional information", { exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(additional).toHaveAttribute("open");
  await expect(
    page.getByRole("button", { name: "Payments 17", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Merchant category code (four digits)").fill("5732");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const request = page.waitForRequest((r) => r.url().endsWith("/simulations"));
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const scenario = (await request).postDataJSON().scenario as Scenario;
  const added = scenario.payments.filter((p) => !/^H\d+$/.test(p.id));
  expect(added).toHaveLength(2);
  expect(added.find((p) => p.amountMinor === 5000)).toMatchObject({
    category: "groceries",
    modelInput: { channel: "Chip Transaction", mcc: "5411", completed: true },
  });
  expect(added.find((p) => p.amountMinor === 1234)).toMatchObject({
    category: "electronics",
    modelInput: {
      channel: "Online Transaction",
      mcc: "5732",
      completed: false,
    },
  });
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
});
