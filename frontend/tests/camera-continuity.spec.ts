import { test, expect, type Page } from "@playwright/test";
import { openExampleWorkspace } from "./workspace-helpers";

async function camera(page: Page) {
  return page.locator(".react-flow__viewport").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
}
async function expectCamera(
  page: Page,
  expected: Awaited<ReturnType<typeof camera>>,
) {
  await expect
    .poll(async () => {
      const actual = await camera(page);
      return Math.max(
        Math.abs(actual.x - expected.x),
        Math.abs(actual.y - expected.y),
        Math.abs(actual.zoom - expected.zoom) * 1000,
      );
    })
    .toBeLessThan(0.2);
}
for (const view of ["small", "overview", "leaf"] as const) {
  test(`camera survives simulation and editing in ${view} view`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await openExampleWorkspace(page);
    if (view !== "small") {
      await page
        .getByRole("button", { name: "Import CSV", exact: true })
        .click();
      await page.getByLabel("CSV file").setInputFiles("public/samples/ibm/online-episode.csv");
      await page.getByRole("button", { name: "Preview graph" }).click();
      await page.getByRole("button", { name: "Build graph" }).click();
      await expect(page.locator(".graph-stage")).not.toHaveClass(
        /graph-reveal/,
        { timeout: 8000 },
      );
      if (view === "leaf") {
        for (let i = 0; i < 8; i++) {
          if (
            (await page
              .locator(".hierarchy-stage")
              .getAttribute("data-detail")) === "true"
          )
            break;
          await page.locator(".transaction-sector").first().press("Enter");
          await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
            "data-transitioning",
            "false",
          );
        }
        await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
          "data-detail",
          "true",
        );
      }
    }
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(350);
    await page.mouse.move(200, 680);
    await page.mouse.down();
    await page.mouse.move(240, 710, { steps: 5 });
    await page.mouse.up();
    const before = await camera(page);
    const group =
      view === "small"
        ? ""
        : await page.locator(".hierarchy-navigation").innerText();
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    await expect(
      page.getByRole("main", { name: "RiskFlow run snapshot" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expectCamera(page, before);
    if (view !== "small")
      expect(await page.locator(".hierarchy-navigation").innerText()).toBe(
        group,
      );
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(350);
    const replay = await camera(page);
    await page
      .getByRole("button", { name: "Edit scenario", exact: true })
      .click();
    await expect(
      page.getByRole("main", { name: "RiskFlow graph workspace" }),
    ).toBeVisible();
    await expectCamera(page, replay);
    if (view !== "small")
      expect(await page.locator(".hierarchy-navigation").innerText()).toBe(
        group,
      );
  });
}
