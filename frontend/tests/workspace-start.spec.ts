import { test, expect, type Page } from "@playwright/test";
import { syntheticModelCsv } from "./workspace-helpers";

async function importStatement(page: Page) {
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
}

test("a fresh session is empty and black, works without templates, and has no theme switching", async ({
  page,
}) => {
  const templateRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/templates/"))
      templateRequests.push(request.url());
  });
  await page.route("**/api/v1/templates", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Payments 0" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.getByRole("region", { name: "Add objects" })).toBeVisible();
  await page.locator('[data-tray-id="tray-account"]').press("Enter");
  await page.getByRole("button", { name: "Place at center" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("button", { name: "Payments 0" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(templateRequests).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`CSV menu stays above group navigation and Objects follows detail at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const initialObjects = await page.locator(".objects-toggle").boundingBox();
    expect(initialObjects!.y).toBe(width <= 600 ? 71 : 82);
    // Both icon boxes and their actual paths are centered within the buttons.
    for (const selector of [".scenario-toggle", ".objects-toggle"]) {
      const offset = await page.locator(selector).evaluate((button) => {
        const b = button.getBoundingClientRect();
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        const path = button.querySelector("path")!.getBoundingClientRect();
        return [icon, path].map((r) =>
          Math.abs(r.y + r.height / 2 - b.y - b.height / 2),
        );
      });
      expect(Math.max(...offset)).toBeLessThanOrEqual(1);
    }
    await importStatement(page);
    const groupBar = await page.locator(".hierarchy-navigation").boundingBox();
    expect(groupBar!.y).toBe(width <= 600 ? 118 : 82);
    const objects = page.getByRole("button", { name: "Objects", exact: true });
    await expect(objects).toHaveCount(0);
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    const layering = await page.evaluate(() => {
      const panel = document.querySelector(".import-inspector")!;
      const p = panel.getBoundingClientRect();
      const n = document
        .querySelector(".hierarchy-navigation")!
        .getBoundingClientRect();
      const x = (Math.max(p.left, n.left) + Math.min(p.right, n.right)) / 2;
      const y = (Math.max(p.top, n.top) + Math.min(p.bottom, n.bottom)) / 2;
      return {
        overlaps:
          p.left < n.right &&
          p.right > n.left &&
          p.top < n.bottom &&
          p.bottom > n.top,
        panelOnTop: panel.contains(document.elementFromPoint(x, y)),
      };
    });
    expect(layering).toEqual({ overlaps: true, panelOnTop: true });
    await page.screenshot({
      path: `../.cache/dev/import-layering-${width}.png`,
    });
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    for (let depth = 0; depth < 12; depth++) {
      if (await page.locator('.hierarchy-stage[data-detail="true"]').count())
        break;
      await expect(objects).toHaveCount(0);
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
    await objects.click();
    await expect(
      page.getByRole("region", { name: "Add objects" }),
    ).toBeVisible();
    const assertStack = async () => {
      const bar = (await page.locator(".hierarchy-navigation").boundingBox())!;
      const button = (await objects.boundingBox())!;
      const tray = (await page.locator(".tray-surface").boundingBox())!;
      expect(button.y).toBeGreaterThanOrEqual(bar.y + bar.height + 10);
      expect(tray.y).toBeGreaterThanOrEqual(button.y + button.height + 10);
      const account = (await page
        .locator('[data-tray-id="tray-account"]')
        .boundingBox())!;
      expect(account.y).toBeGreaterThanOrEqual(tray.y);
      expect(account.y + account.height).toBeLessThan(tray.y + tray.height);
    };
    await assertStack();
    await page.screenshot({
      path: `../.cache/dev/controls-stack-${width}.png`,
    });
    // A wrapped breadcrumb must move both the tray and its draggable objects.
    await page.setViewportSize({
      width: width === 1440 ? 390 : 1440,
      height: 900,
    });
    await expect(async () => {
      await assertStack();
    }).toPass();
    await page
      .getByRole("navigation", { name: "Transaction groups" })
      .getByRole("button", { name: "All payments", exact: true })
      .click();
    await expect(objects).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Add objects" })).toHaveCount(
      0,
    );
  });
}
