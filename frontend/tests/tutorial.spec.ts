import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openExampleWorkspace } from "./workspace-helpers";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`graph tour follows real navigation and evidence at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(70000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("riskflow:tutorial:v2"));
    await page.reload();
    const intro = page.getByRole("dialog", {
      name: "See the story behind the transactions",
    });
    await expect(intro).toBeVisible();
    await expect(intro).toHaveCSS("opacity", "1");
    await expect(intro).not.toContainText(/minutes|upload needed/i);
    await expect(
      intro.getByRole("button", { name: "Explore on my own" }),
    ).toHaveCount(0);
    const startBox = (await intro
      .getByRole("button", { name: "Show me around", exact: true })
      .boundingBox())!;
    const buildBox = (await intro
      .getByRole("button", { name: "Build your own graph", exact: true })
      .boundingBox())!;
    expect(buildBox.x).toBeGreaterThan(startBox.x);
    expect(buildBox.y).toBeCloseTo(startBox.y, 0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("intro.png") });
    await intro
      .getByRole("button", { name: "Show me around", exact: true })
      .click();
    const tour = page.locator(".tutorial-tour");
    const phase = (name: string) =>
      expect(tour).toHaveAttribute("data-phase", name);
    const next = tour.getByRole("button", { name: "Next", exact: true });
    await phase("overview");
    await expect(
      page.getByRole("button", { name: "Payments 250", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".graph-reveal")).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(page.locator(".tour-dimmer")).toHaveAttribute(
      "fill",
      "transparent",
    );
    await expect(next).toBeEnabled({ timeout: 10000 });
    await expect(page.locator(".tour-dimmer")).toHaveCSS(
      "transition-duration",
      "0.42s",
    );
    await expect(page.locator(".tour-focus").first()).toBeVisible();
    await next.click();
    await phase("connections");
    await expect(page.locator(".sector-label").first()).toHaveCSS(
      "pointer-events",
      "none",
    );
    await expect(page.locator(".sector-factor-label").first()).toHaveCSS(
      "text-decoration-line",
      "none",
    );
    await expect(tour.getByRole("button", { name: "Skip tour" })).toHaveCount(
      0,
    );
    // Back returns to the overview and waits for another real navigation action.
    await tour.getByRole("button", { name: "Back", exact: true }).click();
    await phase("overview");
    await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
      "data-tour-depth",
      "0",
    );
    await page
      .locator('.transaction-sector[data-leaf="false"] .sector-label')
      .first()
      .click();
    await phase("connections");
    const connection = page.locator(".connection-target").first();
    const glow = page.locator(".tour-path-glow");
    await expect(glow).toBeVisible();
    await expect(glow).toHaveAttribute(
      "d",
      (await connection.getAttribute("d"))!,
    );
    await expect(glow).toHaveCSS("animation-name", "tour-path-pulse");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(glow).toHaveCSS("animation-name", "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(
      page.locator('.tour-focus[data-tour-target=".connection-target"]'),
    ).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("path.png") });
    if (viewport.width === 390) {
      await connection.focus();
      await connection.press("Enter");
    } else await next.click();
    await expect(
      page.getByRole("region", { name: "Connection evidence" }),
    ).toBeVisible();
    await expect(page.locator(".connection-details")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("connection.png") });
    const panel = page.locator(".connection-details");
    const paymentRow = panel.locator(".connection-payment").first();
    await expect(paymentRow).toHaveAttribute("aria-disabled", "true");
    await expect(paymentRow).not.toHaveAttribute("title");
    await paymentRow.hover();
    await expect(paymentRow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(paymentRow).toHaveCSS("cursor", "default");
    // Navigation stays blocked even for direct pointer and keyboard activation.
    await paymentRow.click({ force: true });
    await panel
      .getByRole("button", { name: "Close connection evidence" })
      .click({ force: true });
    await expect(panel).toBeVisible();
    const firstId = await paymentRow.getAttribute("data-payment-id");
    const pages = panel.getByRole("navigation", {
      name: "Related payment pages",
    });
    await pages.getByRole("button", { name: "Next", exact: true }).click();
    await expect(paymentRow).not.toHaveAttribute("data-payment-id", firstId!);
    await expect(paymentRow).toHaveAttribute("aria-disabled", "true");
    await pages.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(paymentRow).toHaveAttribute("data-payment-id", firstId!);
    await expect(
      page.getByRole("complementary", { name: "Selection details" }),
    ).toHaveCount(0);
    await page.locator(".connection-payment").first().focus();
    await expect(page.locator(".connection-payment").first()).not.toBeFocused();
    await phase("connections");
    await next.click();
    await phase("details");
    for (let level = 0; level < 6; level++) {
      if (await page.locator('.hierarchy-stage[data-detail="true"]').count())
        break;
      const before = await page
        .locator(".hierarchy-stage")
        .getAttribute("data-tour-sector");
      if (viewport.width === 390)
        await page.locator(".sector-label").first().click();
      else await next.click();
      await expect(page.locator(".hierarchy-stage")).not.toHaveAttribute(
        "data-tour-sector",
        before!,
      );
    }
    await phase("return");
    await page.screenshot({ path: testInfo.outputPath("return.png") });
    await expect(
      page.getByRole("complementary", { name: "Selection details" }),
    ).toHaveCount(0);
    await next.click();
    await phase("simulate");
    await next.click();
    await expect(page.locator(".replay")).toHaveAttribute(
      "data-playback-complete",
      "false",
    );
    await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
      "data-tour-depth",
      "0",
    );
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".tour-dimmer")).toHaveAttribute(
      "fill",
      "transparent",
    );
    await expect(next).toBeDisabled();
    const speed = page.getByRole("slider", { name: "Playback speed" });
    await speed.press("Home");
    await expect(speed).toHaveValue("0");
    const speedBox = (await speed.boundingBox())!;
    await speed.click({
      position: { x: speedBox.width - 2, y: speedBox.height / 2 },
    });
    await expect(speed).toHaveValue("4");
    await speed.press("ArrowLeft");
    await expect(speed).toHaveValue("3");
    await expect(page.locator(".replay")).toHaveAttribute(
      "data-playback-complete",
      "true",
      { timeout: 35000 },
    );
    await phase("evidence");
    await tour.getByRole("button", { name: "Back", exact: true }).click();
    await phase("simulate");
    await speed.press("End");
    await expect(tour).toHaveAttribute("data-phase", "evidence", {
      timeout: 35000,
    });
    await expect(
      page.locator('.tour-focus[data-tour-target=".review-total"]'),
    ).toBeVisible();
    await expect(page.locator('[data-tour="results-panel"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("review.png") });
    if (viewport.width === 390) await page.locator(".review-total").click();
    else await next.click();
    await expect(
      page.locator(".tour-focus[data-tour-target*=payment-result]"),
    ).toBeVisible();
    await next.click();
    await phase("complete");
    await expect(page.locator(".payment-explanation")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(
      page.getByRole("region", { name: "Ranking evidence" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Ranking evidence" })
        .getByText("Priority score", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("evidence.png") });
    await next.click();
    await phase("results");
    await expect(
      page.getByRole("complementary", { name: "Completed run totals" }),
    ).toBeVisible();
    await expect(tour.locator(".kicker")).toContainText("6 of 6");
    await expect(
      tour.getByRole("button", { name: "Learn to build a graph" }),
    ).toHaveCount(0);
    await expect(tour.locator(".tour-copy")).toHaveCSS("opacity", "1");
    const finalButtons = tour.locator(".tour-finish-actions button");
    const rows = await finalButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().y),
    );
    expect(rows).toHaveLength(2);
    await expect(
      tour.getByRole("button", { name: "Back", exact: true }),
    ).toHaveCount(0);
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThan(1);
    await expect
      .poll(async () => {
        const coach = (await tour.locator(".tour-coach").boundingBox())!;
        return coach.y + coach.height;
      })
      .toBeLessThanOrEqual(viewport.height - 8);
    const lastAction = (await finalButtons.last().boundingBox())!;
    expect(lastAction.x + lastAction.width).toBeLessThanOrEqual(
      viewport.width - 12,
    );
    await page.screenshot({ path: testInfo.outputPath("results.png") });
    if (viewport.width === 1440) {
      await tour
        .getByRole("button", { name: "Explore the samples", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Start with a sample." }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close sample library" }).click();
    } else {
      await tour
        .getByRole("button", { name: "Import your CSV", exact: true })
        .click();
      await expect(page.getByLabel("CSV file")).toBeVisible();
    }
    await expect(tour).toHaveCount(0);
    await page.getByRole("button", { name: "Show tutorial" }).click();
    await expect(intro).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(intro).toHaveCount(0);
    await page.reload();
    await expect(intro).toHaveCount(0);
  });
}

for (const mode of ["graph", "build"] as const) {
  test(`starting the ${mode} tour protects and replaces an existing workspace`, async ({
    page,
  }) => {
    await openExampleWorkspace(page);
    const payments = await page
      .getByRole("button", { name: /^Payments \d+/ })
      .textContent();
    await page.getByRole("button", { name: "Show tutorial" }).click();
    await page
      .getByRole("button", {
        name: mode === "graph" ? "Show me around" : "Build your own graph",
        exact: true,
      })
      .click();
    const replace = page.getByRole("dialog", {
      name: "Replace this workspace?",
    });
    await expect(replace).toBeVisible();
    await replace.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("dialog", {
        name: "See the story behind the transactions",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close tutorial", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /^Payments \d+/ }),
    ).toHaveText(payments!);
    await page.getByRole("button", { name: "Show tutorial" }).click();
    await page
      .getByRole("button", {
        name: mode === "graph" ? "Show me around" : "Build your own graph",
        exact: true,
      })
      .click();
    await replace.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.locator(".tutorial-tour")).toHaveAttribute(
      "data-phase",
      mode === "graph" ? "overview" : "objects",
    );
    await expect(
      page.getByRole("button", {
        name: mode === "graph" ? "Payments 250" : "Payments 0",
        exact: true,
      }),
    ).toBeVisible();
    if (mode === "build") {
      await expect(page.locator(".react-flow__node")).toHaveCount(0);
      const next = page
        .locator(".tutorial-tour")
        .getByRole("button", { name: "Next", exact: true });
      await next.click();
      await expect(page.locator(".tutorial-tour")).toHaveAttribute(
        "data-phase",
        "account",
      );
      await next.click();
      await expect(page.locator(".react-flow__node")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(page.locator(".tutorial-tour")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: mode === "graph" ? "Payments 250" : "Payments 0",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", { name: "Payments", exact: true }),
    ).toBeVisible();
  });
}

test("building from a simulation clears the old graph and run after confirmation", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".replay")).toBeVisible();
  await page.getByRole("button", { name: "Show tutorial" }).click();
  await page
    .getByRole("button", { name: "Build your own graph", exact: true })
    .click();
  const replace = page.getByRole("dialog", { name: "Replace this workspace?" });
  await expect(replace).toBeVisible();
  await expect(page.locator(".replay")).toBeVisible();
  await replace.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.locator(".tutorial-tour")).toHaveAttribute(
    "data-phase",
    "objects",
  );
  await expect(page.locator(".replay")).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close tutorial" }).click();
  await expect(
    page.getByRole("button", { name: "Last run", exact: true }),
  ).toHaveCount(0);
});

test("failed sample downloads keep the intro retryable and can be dismissed", async ({
  page,
}) => {
  await page.route("**/samples/scenarios/online-episode.csv", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Show tutorial" }).click();
  await page
    .getByRole("button", { name: "Show me around", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "could not be downloaded",
  );
  await expect(
    page.getByRole("button", { name: "Show me around", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tutorial-intro")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`Next demonstrates the complete building tour at ${width}px and validates the payment`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Show tutorial" }).click();
    await page
      .getByRole("button", { name: "Build your own graph", exact: true })
      .click();
    const tour = page.locator(".tutorial-tour");
    const next = tour.getByRole("button", { name: "Next", exact: true });
    for (const phase of ["objects", "account", "edit", "merchant", "connect"]) {
      await expect(tour).toHaveAttribute("data-phase", phase);
      if (phase !== "objects")
        await expect(
          tour.getByRole("button", { name: "Skip tour" }),
        ).toHaveCount(0);
      await next.click();
    }
    await expect(tour).toHaveAttribute("data-phase", "payment");
    await page.getByLabel("Amount · USD").fill("0");
    await next.click();
    await expect(tour).toHaveAttribute("data-phase", "payment");
    await expect(
      page.getByRole("button", { name: "Payments 0", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Amount · USD").fill("50");
    await next.click();
    await expect(tour).toHaveAttribute("data-phase", "simulate");
    await expect(
      page.getByRole("button", { name: "Payments 1", exact: true }),
    ).toBeVisible();
    await next.click();
    await expect(page.locator(".replay")).toHaveAttribute(
      "data-playback-complete",
      "false",
    );
    await page.getByRole("slider", { name: "Playback speed" }).press("Home");
    await expect(
      page.getByRole("slider", { name: "Playback speed" }),
    ).toHaveValue("0");
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".replay")).toHaveAttribute(
      "data-playback-complete",
      "true",
    );
    await expect(tour).toHaveAttribute("data-phase", "results");
    await next.click();
    await expect(
      page.getByRole("complementary", { name: "Completed run totals" }),
    ).toBeVisible();
    await page.clock.install();
    await page.clock.fastForward(3000);
    await expect(tour).toHaveAttribute("data-phase", "results");
    await next.click();
    await expect(tour).toHaveAttribute("data-phase", "samples");
    await next.click();
    await expect(
      page.getByRole("dialog", { name: "Start with a sample." }),
    ).toBeVisible();
    await expect(tour).toHaveCount(0);
  });
}
