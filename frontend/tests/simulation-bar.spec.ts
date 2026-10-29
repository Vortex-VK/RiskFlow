import { test, expect } from "@playwright/test";
import { openExampleWorkspace } from "./workspace-helpers";

test("CSV growth gates simulation and the workspace bar fades in only when ready", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/");
  await expect(page.locator(".workspace-bar")).toHaveCount(0);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/samples/ibm/online-episode.csv");
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(page.locator(".graph-stage")).toHaveClass(/graph-reveal/);
  await expect(page.locator(".workspace-bar")).toHaveCount(0);
  const blocked = await page.evaluate(async () => {
    const { useSimulation } = await import("/src/state/simulation.ts");
    await useSimulation.getState().run();
    return {
      pending: useSimulation.getState().pending,
      viewing: useSimulation.getState().viewing,
    };
  });
  expect(blocked).toEqual({ pending: false, viewing: false });
  await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/, {
    timeout: 10000,
  });
  const bar = page.locator(".workspace-bar");
  await expect(bar).toHaveCSS("opacity", "1");
  expect(
    await bar.evaluate((e) =>
      parseFloat(getComputedStyle(e).transitionDuration),
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/);
});

test("the last transaction controls bar visibility and exit is inert immediately", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await page.evaluate(async () => {
    const { useWorkspace } = await import("/src/state/workspace.ts");
    const document = structuredClone(useWorkspace.getState().document!);
    document.scenario.payments = document.scenario.payments.slice(0, 1);
    document.scenario.groundTruth = {};
    useWorkspace.getState().replace(document);
  });
  const bar = page.locator(".workspace-bar");
  await expect(bar).toHaveCSS("opacity", "1");
  await page.evaluate(async () => {
    const { useWorkspace } = await import("/src/state/workspace.ts");
    const document = structuredClone(useWorkspace.getState().document!);
    document.scenario.payments = [];
    useWorkspace.getState().commit(document, "Removed last payment");
  });
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('.presence[data-visible="false"][inert] .workspace-bar'),
  ).toHaveCount(1);
  await expect(bar).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(bar).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Clear board", exact: true }).click();
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  if (await discard.isVisible()) await discard.click();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(bar).toHaveCount(0);
});
