import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { setReviewCapacity } from "./workspace-helpers";

test("landing is the default, works without the API and discloses the evaluation scope", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(request.url());
  });
  await page.route("**/api/v1/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know which payments",
  );
  await expect(page).toHaveTitle(/Payment fraud investigation/);
  await expect(page.locator(".workspace")).toHaveCount(0);
  await expect(page.locator(".landing-result-primary")).toContainText("85.9%");
  await expect(page.locator(".landing-results")).toContainText("186,320");
  await expect(page.locator(".landing-cross-source")).toContainText("80.1%");
  await expect(page.locator(".landing-results-panel")).toContainText(
    "highest-priority 5%",
  );
  await expect(page.locator(".landing-result-primary")).toContainText(
    "237 of 276",
  );
  const selectedFraction = await page
    .locator(".landing-ranked-selected")
    .evaluate(
      (element) =>
        element.getBoundingClientRect().width /
        element.parentElement!.getBoundingClientRect().width,
    );
  expect(selectedFraction).toBeCloseTo(0.05, 2);
  await expect(page.locator(".landing-ranked-bar")).toHaveCount(1);
  await expect(page.locator(".landing-rank-direction")).toContainText(
    "Highest priority",
  );
  await expect(page.locator(".landing-page")).not.toContainText("False alerts");
  for (const screenshot of await page
    .locator(".landing-step-image img")
    .all()) {
    await screenshot.scrollIntoViewIfNeeded();
    await expect(screenshot).toBeVisible();
    await expect
      .poll(() =>
        screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await expect(page.locator(".landing-cross-source")).toContainText(
    "including IBM",
  );
  await expect(page.locator(".landing-cross-source")).toContainText(
    "weighted equally",
  );
  await expect(
    page.locator(".landing-step-image a, a.landing-step-image"),
  ).toHaveCount(0);
  await expect(
    page.locator(".landing-samples, .landing-final, .landing-footer"),
  ).toHaveCount(0);
  const technical = page.locator(".landing-technical");
  await expect(technical).not.toHaveAttribute("open", "");
  await technical.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(technical).toHaveAttribute("open", "");
  await expect(technical.locator("tbody tr")).toHaveCount(5);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download evaluation/ }).click();
  const download = await downloadEvent;
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(
    data.datasets.find((row: { id: string }) => row.id === "ibm").detections,
  ).toBe(237);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(requests).toEqual([]);
});

for (const width of [1440, 390, 320]) {
  test(`landing fits and is accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Explore RiskFlow" }),
    ).toBeVisible();
    expect(
      await page
        .locator(".landing-page")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `../.cache/dev/landing-${width}.png` });
    await page.locator(".landing-technical summary").click();
    const header = await page.locator(".landing-header").boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(0);
    expect(header!.y + header!.height).toBeLessThan(100);
    expect(
      await page
        .locator(".landing-page")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Open workspace", exact: true })
      .click();
    await expect(
      page.getByRole("main", { name: "RiskFlow graph workspace" }),
    ).toBeVisible();
  });
}

test("home navigation preserves graph edits, drafts and browser history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore RiskFlow" }).click();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.locator('[data-tray-id="tray-account"]').press("Enter");
  await page.getByRole("button", { name: "Place at center" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page
    .getByLabel("Name", { exact: true })
    .fill("Unfinished account edit");
  await page.getByRole("link", { name: "RiskFlow home" }).click();
  await expect(page.locator(".landing-page")).toBeVisible();
  // Hidden workspace shortcuts must not undo the retained graph.
  await page.keyboard.press("Control+z");
  await page.getByRole("link", { name: "Return to your workspace" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Unfinished account edit",
  );
  await page.goBack();
  await expect(page.locator(".landing-page")).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Unfinished account edit",
  );
});

test("replay brand returns home and preserves the run and manual review queue", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/workspace");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByRole("button", { name: /First five payments/ }).click();
  await page
    .getByRole("button", { name: "Open in workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await setReviewCapacity(page, 3);
  const slider = page.getByRole("slider", {
    name: "Review capacity",
    exact: true,
  });
  const capacity = await slider.getAttribute("aria-valuetext");
  await page.getByRole("link", { name: "RiskFlow home" }).click();
  await expect(page.locator(".landing-page")).toBeVisible();
  await page.getByRole("link", { name: "Return to your workspace" }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuetext", capacity!);
  await page.getByRole("link", { name: "RiskFlow home" }).click();
  await page.reload();
  await expect(page.locator(".landing-page")).toBeVisible();
  await expect(page.locator(".landing-technical")).not.toHaveAttribute(
    "open",
    "",
  );
});

test("first-time onboarding opens only after entering the workspace", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.removeItem("riskflow:tutorial:v2"),
  );
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Explore RiskFlow" }).click();
  await expect(
    page.getByRole("dialog", { name: "See the story behind the transactions" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator(".landing-page")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "See the story behind the transactions" }),
  ).toBeVisible();
});
