import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fillModelInputs, openExampleWorkspace } from "./workspace-helpers";

const node = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`);
async function center(page: Page, id: string) {
  const box = await node(page, id).boundingBox();
  if (!box) throw new Error(`Missing node ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function startConnection(page: Page, from: string, to: string) {
  const start = await center(page, from);
  const end = await center(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(page.locator(".connection-preview")).toBeVisible();
}

async function expectClearConnectionTargets(page: Page) {
  const overlaps = await page.evaluate(async () => {
    const samples: number[] = [];
    for (let frame = 0; frame < 24; frame++) {
      await new Promise(requestAnimationFrame);
      const card = document
        .querySelector(".tour-coach")!
        .getBoundingClientRect();
      for (const kind of ["account", "merchant"]) {
        const object = document
          .querySelector(`.react-flow__node:has(.node-${kind})`)!
          .getBoundingClientRect();
        samples.push(
          Math.max(
            0,
            Math.min(card.right, object.right) -
              Math.max(card.left, object.left),
          ) *
            Math.max(
              0,
              Math.min(card.bottom, object.bottom) -
                Math.max(card.top, object.top),
            ),
        );
      }
    }
    return Math.max(...samples);
  });
  expect(overlaps).toBe(0);
}

test("hands-on tour advances only after real actions and can finish a complete scenario", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("riskflow:tutorial:v2"));
  await page.reload();
  const tour = page.locator(".tutorial-tour");
  const phase = (value: string) =>
    expect(tour).toHaveAttribute("data-phase", value);
  await phase("objects");
  await expect(page.locator(".tour-dimmer")).toHaveAttribute(
    "fill",
    "rgba(0, 0, 0, 0.62)",
  );
  await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "false");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await phase("account");
  await expect(
    page.getByText("Drag into the canvas", { exact: true }),
  ).toHaveCount(0);
  const place = async (kind: string, x: number, y: number) => {
    const box = (await page
      .locator(`[data-tray-id="tray-${kind}"]`)
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.up();
  };
  await place("account", 600, 400);
  await phase("edit");
  await expect(
    page.locator(
      ".tour-focus[data-tour-target='[data-tour=\"starter-context\"]']",
    ),
  ).toBeVisible();
  const account = page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-account") });
  const accountId = (await account.getAttribute("data-id"))!;
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Practice account");
  await page.getByRole("button", { name: "Create starter context" }).click();
  await phase("merchant");
  if (!(await page.locator("#object-drawer").isVisible()))
    await page.getByRole("button", { name: "Objects", exact: true }).click();
  await place("merchant", 950, 450);
  await phase("connect");
  await expectClearConnectionTargets(page);
  const guide = page.locator(".tour-connection-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toHaveCSS("animation-name", "tutorial-draw-connection");
  const beforeAnimation = await guide.evaluate(
    (el) => el.getAnimations()[0]!.currentTime as number,
  );
  await expect
    .poll(() =>
      guide.evaluate((el) => el.getAnimations()[0]!.currentTime as number),
    )
    .toBeGreaterThan(beforeAnimation);
  const merchantId = (await page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-merchant") })
    .getAttribute("data-id"))!;
  await startConnection(page, accountId, merchantId);
  await expect(guide).toBeHidden();
  await page.keyboard.press("Escape");
  await page.mouse.up({ button: "right" });
  await phase("connect");
  await expect(page.locator(".connection-preview")).toHaveCount(0);
  await startConnection(page, accountId, merchantId);
  await page.mouse.up({ button: "right" });
  await phase("payment");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await phase("connect");
  await startConnection(page, accountId, merchantId);
  await page.mouse.up({ button: "right" });
  await phase("payment");
  await page.getByLabel("Amount · USD").fill("0");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await phase("payment");
  await page.getByLabel("Amount · USD").fill("50.00");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await phase("simulate");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await phase("results");
  await expect(page.locator("#tutorial-text")).toContainText(
    "payment totals, risk scores, and review workload",
  );
  await expect(tour.locator(".kicker")).toContainText("8 of 9");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toBeVisible();
  await phase("results");
  await phase("samples");
  await expect(tour.locator(".kicker")).toContainText("9 of 9");
  await expect(
    page.locator(".tour-focus[data-tour-target='[data-tour=\"samples\"]']"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const samples = page.getByRole("dialog", { name: "Start with a sample." });
  await expect(samples).toBeVisible();
  await expect(tour).toHaveCount(0);
  await samples.getByRole("button", { name: /First five payments/ }).click();
  await expect(samples.getByRole("heading", { level: 2 })).toHaveText(
    "First five payments",
  );
  await samples.getByRole("button", { name: "Open in workspace" }).click();
  const replaceSample = page.getByRole("dialog", {
    name: "Replace this workspace?",
  });
  await expect(replaceSample).toBeVisible();
  await replaceSample
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(samples).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Completed run totals" }),
  ).toBeVisible();
  await expect(
    page.locator(".top-actions").getByRole("button", { name: "Edit scenario" }),
  ).toHaveCount(0);
  const playback = page.getByRole("navigation", { name: "Playback controls" });
  await expect(
    playback.getByRole("button", { name: "Clear board" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Playback controls" })
    .getByRole("button", { name: "Edit scenario" })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Payments 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace tools" })
    .getByRole("button", { name: "Clear board" })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Replace this workspace?",
  });
  await confirmation
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(playback).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Last run", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(tour).toHaveCount(0);
});

test("connection tutorial avoids both objects after resizing and moving them", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Show tutorial" }).click();
  for (const kind of ["account", "merchant"]) {
    await page.getByRole("button", { name: "Objects", exact: true }).click();
    await page
      .getByRole("button", { name: `Add ${kind}`, exact: true })
      .press("Enter");
    await page.getByRole("button", { name: "Place at center" }).click();
    if (kind === "account")
      await page
        .getByRole("button", { name: "Create starter context" })
        .click();
  }
  await expect(page.locator(".tutorial-tour")).toHaveAttribute(
    "data-phase",
    "connect",
  );
  await expect(
    page.getByRole("complementary", { name: "Selection details" }),
  ).toHaveCount(0);
  await expectClearConnectionTargets(page);
  const account = page
    .locator(".react-flow__node")
    .filter({ has: page.locator(".node-account") });
  const box = (await account.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(180, 170, { steps: 12 });
  await expectClearConnectionTargets(page);
  await page.mouse.up();
  for (const viewport of [
    { width: 900, height: 700 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expectClearConnectionTargets(page);
    const coach = (await page.locator(".tour-coach").boundingBox())!;
    expect(coach.x).toBeGreaterThanOrEqual(0);
    expect(coach.y).toBeGreaterThanOrEqual(0);
    expect(coach.x + coach.width).toBeLessThanOrEqual(viewport.width);
    expect(coach.y + coach.height).toBeLessThanOrEqual(viewport.height);
  }
});

test("mobile keyboard placement stays interactive and invalid edits do not advance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Show tutorial" }).click();
  const tour = page.locator(".tutorial-tour");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page
    .getByRole("button", { name: "Add account", exact: true })
    .press("Enter");
  await expect(tour).toHaveAttribute("data-phase", "account");
  const placeBox = (await page
    .getByRole("button", { name: "Place at center" })
    .boundingBox())!;
  const cancelBox = (await page
    .getByRole("button", { name: "Cancel placement" })
    .boundingBox())!;
  expect(cancelBox.x - (placeBox.x + placeBox.width)).toBeGreaterThanOrEqual(
    12,
  );
  await page.getByRole("button", { name: "Place at center" }).click();
  await expect(tour).toHaveAttribute("data-phase", "edit");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("");
  await page.getByRole("button", { name: "Create starter context" }).click();
  await expect(tour).toHaveAttribute("data-phase", "edit");
  await name.fill("Mobile practice");
  await page.getByRole("button", { name: "Create starter context" }).click();
  await expect(tour).toHaveAttribute("data-phase", "merchant");
  const coach = (await page.locator(".tour-coach").boundingBox())!;
  expect(coach.x).toBeGreaterThanOrEqual(0);
  expect(coach.x + coach.width).toBeLessThanOrEqual(390);
  expect(coach.y + coach.height).toBeLessThanOrEqual(844);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

test("skipping the interactive tour preserves an existing unapplied edit", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Keep this draft");
  await page.getByRole("button", { name: "Show tutorial" }).click();
  await expect(page.locator(".tutorial-tour")).toHaveAttribute(
    "data-phase",
    "prepare",
  );
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".tutorial-tour")).toHaveCount(0);
  await expect(name).toHaveValue("Keep this draft");
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
});

test("dimmed objects and controls reject mouse and keyboard actions until the tour closes", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  const account = node(page, "account-a");
  await account.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Name", { exact: true }).fill("Keep this change");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Selection details" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show tutorial" }).click();
  const before = await account.getAttribute("style");
  const point = await center(page, "account-a");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y + 70, { steps: 8 });
  await page.mouse.up();
  await account.dispatchEvent("click");
  await expect(account).toHaveAttribute("style", before!);
  await expect(
    page.getByRole("complementary", { name: "Selection details" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear board", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page
    .getByRole("button", { name: "Samples", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "Close sample library" }),
  ).toHaveCount(0);
  await account.focus();
  await expect(account).not.toBeFocused();
  await page.keyboard.press("Control+z");
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest(".tour-coach, .objects-toggle"),
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".tutorial-tour")).toHaveCount(0);
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Keep this change",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
});

test("clear board is visible, turns red on hover, and preserves edits on cancel", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  const clear = page.getByRole("button", { name: "Clear board", exact: true });
  await expect(clear).toBeEnabled();
  const simulate = page.getByRole("button", { name: "Simulate", exact: true });
  await simulate.hover();
  await expect(simulate).toHaveCSS("background-color", "rgb(39, 39, 39)");
  const normalHover = await simulate.evaluate((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, padding: style.padding };
  });
  await clear.hover();
  await expect(clear).toHaveCSS("background-color", normalHover.background);
  await expect(clear).toHaveCSS("padding", normalHover.padding);
  await expect(clear).toHaveCSS("color", "rgb(239, 163, 155)");
  await clear.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(clear).toBeFocused();
  await expect(clear).toHaveCSS("outline-color", "rgb(239, 163, 155)");
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  const name = page
    .getByRole("complementary", { name: "Selection details" })
    .getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Unapplied change");
  await clear.click();
  const confirmation = page.getByRole("dialog", {
    name: "Replace this workspace?",
  });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(name).toHaveValue("Unapplied change");
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await clear.click();
  await confirmation
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(clear).toBeEnabled();
  await expect(
    page
      .getByRole("navigation", { name: "Workspace tools" })
      .getByRole("button", { name: "Clear board" }),
  ).toBeVisible();
  await clear.hover();
  await expect(clear).toHaveCSS("background-color", normalHover.background);
  await expect(clear).toHaveCSS("color", "rgb(239, 163, 155)");
  const clearBox = (await clear.boundingBox())!;
  const redoBox = (await page
    .getByRole("button", { name: "Redo", exact: true })
    .boundingBox())!;
  expect(clearBox.y + clearBox.height / 2).toBeCloseTo(
    redoBox.y + redoBox.height / 2,
    0,
  );
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page
    .getByRole("button", { name: "Open in workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Payments 250", exact: true }),
  ).toBeVisible();
  await clear.click();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
});

test("close icons are centered across workspace panels and the motion toggle is gone", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  const check = async (label: string) => {
    const button = page.getByRole("button", { name: label, exact: true });
    const { bounds, icon } = await button.evaluate((el) => ({
      bounds: el.getBoundingClientRect().toJSON(),
      icon: el.querySelector("svg")!.getBoundingClientRect().toJSON(),
    }));
    expect(
      Math.abs(bounds.x + bounds.width / 2 - icon.x - icon.width / 2),
    ).toBeLessThan(0.1);
    expect(
      Math.abs(bounds.y + bounds.height / 2 - icon.y - icon.height / 2),
    ).toBeLessThan(0.1);
    await button.click();
  };
  await page.getByRole("button", { name: "Show tutorial" }).click();
  await check("Close tutorial");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await check("Close CSV import");
  await page.getByRole("button", { name: "Payments 16", exact: true }).click();
  await check("Close payments");
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  await check("Close details");
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  await node(page, "account-a").focus();
  await page.keyboard.press("c");
  await node(page, "grocery").focus();
  await page.keyboard.press("Enter");
  await check("Close details");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await check("Close sample library");
  await page.getByRole("button", { name: "About this workspace" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Animate objects" }),
  ).toHaveCount(0);
});

test("right-drag opens a payment draft in either direction and adding can be undone", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  const before = await node(page, "account-a").getAttribute("style");
  await startConnection(page, "account-a", "grocery");
  await expect(node(page, "grocery").locator(".node-compatible")).toHaveCount(
    1,
  );
  await expect(node(page, "account-b").locator(".node-compatible")).toHaveCount(
    0,
  );
  await page.mouse.up({ button: "right" });
  const inspector = page.getByRole("complementary", {
    name: "Selection details",
  });
  await expect(inspector.getByRole("heading")).toHaveText("New payment");
  await inspector
    .getByText("Endpoints & synthetic label", { exact: true })
    .click();
  await expect(
    inspector.getByRole("combobox", { name: "Account", exact: true }),
  ).toHaveValue("account-a");
  await expect(
    inspector.getByRole("combobox", { name: "Merchant", exact: true }),
  ).toHaveValue("grocery");
  await expect(node(page, "account-a")).toHaveAttribute("style", before!);
  await inspector.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await startConnection(page, "grocery", "account-a");
  await page.mouse.up({ button: "right" });
  await expect(inspector.getByRole("heading")).toHaveText("New payment");
  await fillModelInputs(page);
  await inspector.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Payments 17", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
});

test("invalid drops, empty canvas and Escape leave no connection", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await startConnection(page, "account-a", "account-b");
  await page.mouse.up({ button: "right" });
  await expect(page.getByRole("status")).toContainText("Choose an account");
  await startConnection(page, "account-a", "grocery");
  await page.keyboard.press("Escape");
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".connection-preview")).toHaveCount(0);
  await startConnection(page, "account-a", "grocery");
  await page.mouse.move(700, 760);
  await page.mouse.up({ button: "right" });
  await expect(
    page.getByRole("complementary", { name: "Selection details" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 16", exact: true }),
  ).toBeVisible();
});

test("right-drag opens existing context and refuses unapplied edits", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await startConnection(page, "account-a", "device-a");
  await page.mouse.up({ button: "right" });
  const inspector = page.getByRole("complementary", {
    name: "Selection details",
  });
  await expect(inspector.getByRole("heading")).toHaveText(
    "Context relationship",
  );
  await inspector.getByRole("button", { name: "Close details" }).click();
  await node(page, "account-a").focus();
  await page.keyboard.press("Enter");
  await inspector
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Unapplied name");
  const start = await center(page, "account-a");
  const end = await center(page, "grocery");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(end.x, end.y);
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".connection-preview")).toHaveCount(0);
  await expect(
    inspector.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Unapplied name");
});

test("the supplied 9000-row export is blocked before graph creation by default", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("../fixtures/imports/riskflow_transactions_l_9000.csv");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot import for simulation",
  );
  await expect(page.getByRole("button", { name: "Build graph" })).toHaveCount(
    0,
  );
  await page.getByLabel("Import purpose").selectOption("graph");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("Missing model inputs prevent simulation");
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("navigation", { name: "Workspace tools" }),
  ).not.toContainText("payments need model inputs");
});

test("panels animate on exit and disclosures respect reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  const disclosure = page.locator(".about details");
  await expect(disclosure).toHaveAttribute("open");
  expect(
    await disclosure.evaluate(
      (el) => getComputedStyle(el, "::details-content").transitionDuration,
    ),
  ).toContain("0.42s");
  await page.getByRole("button", { name: "About this workspace" }).click();
  const exit = page.locator('.presence[data-visible="false"] > .about');
  await expect(exit).toHaveCSS("transition-duration", "0.42s");
  await expect(page.locator(".about")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "About this workspace" }).click();
  await expect(page.locator(".about")).toHaveCSS("animation-name", "none");
  expect(
    await disclosure.evaluate(
      (el) => getComputedStyle(el, "::details-content").transitionDuration,
    ),
  ).toBe("0s");
});

test("menus fade in and out without shifting tray objects, including a quick reopen", async ({
  page,
}) => {
  await page.goto("/");
  for (const [label, selector] of [
    ["Objects", ".object-tray"],
    ["Import CSV", ".import-inspector"],
    ["About this workspace", ".about"],
  ]) {
    for (const opening of [true, false]) {
      const sample = await page.evaluate(
        async ({ label, selector, opening }) => {
          const toggle = [
            ...document.querySelectorAll<HTMLButtonElement>("button"),
          ].find(
            (button) =>
              button.getAttribute("aria-label") === label ||
              button.textContent?.trim() === label,
          )!;
          toggle.click();
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const menu = document.querySelector<HTMLElement>(selector)!;
          const animations = menu.getAnimations();
          const duration = Number(animations[0]?.effect?.getTiming().duration);
          animations.forEach((animation) => {
            animation.pause();
            animation.currentTime = 140;
          });
          const firstOpacity = Number(getComputedStyle(menu).opacity);
          const tray = menu
            .querySelector(".tray-surface")
            ?.getBoundingClientRect();
          const contained =
            !tray ||
            [...menu.querySelectorAll(".tray-object")].every((object) => {
              const bounds = object.getBoundingClientRect();
              return (
                bounds.left >= tray.left &&
                bounds.right <= tray.right &&
                bounds.top >= tray.top &&
                bounds.bottom <= tray.bottom
              );
            });
          animations.forEach((animation) => {
            animation.currentTime = 300;
          });
          const secondOpacity = Number(getComputedStyle(menu).opacity);
          if (opening) animations.forEach((animation) => animation.finish());
          return { duration, firstOpacity, secondOpacity, contained };
        },
        { label: label!, selector: selector!, opening },
      );
      expect(sample.duration).toBe(420);
      expect(sample.firstOpacity).toBeGreaterThan(0);
      expect(sample.firstOpacity).toBeLessThan(1);
      expect(sample.contained).toBe(true);
      if (opening)
        expect(sample.secondOpacity).toBeGreaterThan(sample.firstOpacity);
      else {
        expect(sample.secondOpacity).toBeLessThan(sample.firstOpacity);
        await expect(page.locator(selector!)).toHaveCount(0);
      }
    }
  }
  const objects = page.getByRole("button", { name: "Objects", exact: true });
  await objects.click();
  await objects.click();
  await objects.click();
  await expect(page.getByRole("region", { name: "Add objects" })).toBeVisible();
  await expect(page.locator(".object-tray")).toHaveCSS("opacity", "1");
  await expect(page.locator(".tray-object")).toHaveCount(4);
});
