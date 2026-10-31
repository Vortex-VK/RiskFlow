import { setPlaybackPosition } from "./workspace-helpers";
import { openExampleWorkspace, setPlaybackSpeed } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await openExampleWorkspace(page);
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
});

test("completed playback shows run totals while H16 and H10 keep their own decisions", async ({
  page,
}) => {
  const account = page.locator('.react-flow__node[data-id="account-a"]');
  const draftPosition = await account.evaluate(
    (el) => (el as HTMLElement).style.transform,
  );
  const dragAccount = async () => {
    const before = await account.boundingBox();
    const edge = page.locator(
      '.react-flow__edge[data-id="account-a-device-shared-link"] .react-flow__edge-path',
    );
    const path = await edge.getAttribute("d");
    await page.mouse.move(before!.x + 50, before!.y + 50);
    await page.mouse.down();
    await page.mouse.move(before!.x + 110, before!.y + 70, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => (await account.boundingBox())!.x)
      .toBeGreaterThan(before!.x + 45);
    await expect(edge).not.toHaveAttribute("d", path!);
  };
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Playback speed" }),
  ).toHaveValue("2");
  await setPlaybackSpeed(page, 2);
  await dragAccount();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Run complete", {
    timeout: 20000,
  });
  await dragAccount();
  await expect(page.getByRole("status")).toContainText(
    "15 no alert \u00b7 1 for review",
  );
  await expect(page.getByRole("status")).not.toContainText("0/100");
  await expect(page.getByRole("status")).not.toContainText("Time compressed");
  await expect(page.getByRole("status")).not.toContainText(
    "Limited source data",
  );
  await expect(
    page.getByRole("status").getByRole("button", { name: "Inspect payments" }),
  ).toHaveCount(0);
  const inspectPayments = page
    .locator(".top-actions")
    .getByRole("button", { name: "Inspect payments", exact: true });
  const inspectBox = (await inspectPayments.boundingBox())!;
  const resultsBox = (await page
    .getByRole("button", { name: "Results", exact: true })
    .boundingBox())!;
  expect(inspectBox.y).toBe(resultsBox.y);
  expect(inspectBox.x + inspectBox.width).toBeLessThan(resultsBox.x);
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await expect(inspectPayments).toHaveAttribute("aria-expanded", "true");
  const paymentPanel = page.getByRole("region", { name: "Run events" });
  await expect(paymentPanel).toHaveClass(/inspector run-inspector/);
  await expect(paymentPanel).toBeVisible();
  await expect(paymentPanel).not.toContainText(/\d{2}:\d{2}:\d{2}/);
  const cards = paymentPanel.getByRole("button", { name: /^Inspect H/ });
  const first = (await cards.nth(0).boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  const third = (await cards.nth(2).boundingBox())!;
  const fourth = (await cards.nth(3).boundingBox())!;
  expect(second.y).toBe(first.y);
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(third.y).toBe(first.y);
  expect(third.x).toBeGreaterThan(second.x + second.width);
  expect(fourth.y).toBeGreaterThan(first.y + first.height);
  await expect(paymentPanel).not.toContainText("estimated fraud");
  await page.getByRole("button", { name: "Inspect H16", exact: true }).click();
  const explanation = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  await expect(explanation.getByRole("heading").first()).toContainText("H16");
  await expect(explanation.locator(".decision")).toContainText("no alert");
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  await expect(explanation.getByRole("heading").first()).toContainText("H10");
  await expect(page.locator('.status[role="status"]')).toContainText(
    "Run complete",
  );
  await expect(
    page.getByRole("button", { name: "Play again", exact: true }),
  ).toBeVisible();
  await expect(explanation.locator(".decision")).toContainText("no alert");
  await page.getByRole("button", { name: "Close explanation" }).click();
  await account.hover();
  await expect(account.locator(".source")).toBeHidden();
  const movedPosition = await account.evaluate(
    (el) => (el as HTMLElement).style.transform,
  );
  const cancelOrigin = await account.boundingBox();
  await page.mouse.move(cancelOrigin!.x + 50, cancelOrigin!.y + 50);
  await page.mouse.down();
  await page.mouse.move(cancelOrigin!.x + 120, cancelOrigin!.y + 70, {
    steps: 6,
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect
    .poll(() => account.evaluate((el) => (el as HTMLElement).style.transform))
    .toBe(movedPosition);
  await account.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => account.evaluate((el) => (el as HTMLElement).style.transform))
    .not.toBe(movedPosition);
  await page.keyboard.press("Enter");
  await expect(account.locator(".source")).toBeHidden();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await expect
    .poll(() => account.evaluate((el) => (el as HTMLElement).style.transform))
    .toBe(draftPosition);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).not.toContainText(
    "Changes not simulated",
  );
});

test("paused and completed dragging keeps objects visible and connections mounted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  const account = page.locator('.react-flow__node[data-id="account-b"]');
  const graphElements = page.locator(".react-flow__node, .react-flow__edge");
  for (const completed of [false, true]) {
    if (completed) {
      await setPlaybackSpeed(page, 5);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Run complete");
    }
    for (const dark of [true]) {
      if (dark)
        await expect(
          page.getByRole("button", { name: /Switch to .* mode/ }),
        ).toHaveCount(0);
      await expect
        .poll(() =>
          page
            .locator(".react-flow__node")
            .evaluateAll((els) =>
              els.every((el) => getComputedStyle(el).visibility === "visible"),
            ),
        )
        .toBe(true);
      await expect(page.locator(".react-flow__edge")).toHaveCount(21);
      const probe = await page.evaluateHandle(() => {
        const selector = ".react-flow__node, .react-flow__edge";
        const original = [...document.querySelectorAll(selector)];
        const hidden = new Set<string>();
        const removed = new Set<string>();
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            if (
              record.type === "attributes" &&
              record.target instanceof HTMLElement &&
              record.target.matches(".react-flow__node") &&
              (record.target.style.visibility === "hidden" ||
                /visibility:\s*hidden/.test(record.oldValue || ""))
            )
              hidden.add(record.target.dataset.id!);
            for (const node of record.removedNodes) {
              if (!(node instanceof Element)) continue;
              const elements = [...node.querySelectorAll(selector)];
              if (node.matches(selector)) elements.push(node);
              for (const el of elements)
                removed.add(el.getAttribute("data-id")!);
            }
          }
        });
        observer.observe(document.querySelector(".react-flow")!, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["style"],
          attributeOldValue: true,
        });
        return {
          stop: () => {
            observer.disconnect();
            return {
              hidden: [...hidden],
              removed: [...removed],
              originalsConnected: original.every((el) => el.isConnected),
            };
          },
        };
      });
      const box = (await account.boundingBox())!;
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      for (let step = 1; step <= 4; step++) {
        await page.mouse.move(box.x + 50 - step * 12, box.y + 50 + step * 6);
        expect(
          await graphElements.evaluateAll((els) => [
            ...new Set(els.map((el) => getComputedStyle(el).opacity)),
          ]),
        ).toEqual(["1"]);
        if (step === 2)
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
      }
      await page.mouse.up();
      expect(await probe.evaluate((p) => p.stop())).toEqual({
        hidden: [],
        removed: [],
        originalsConnected: true,
      });
      await probe.dispose();
      await expect
        .poll(async () => (await account.boundingBox())!.x)
        .toBeLessThan(box.x - 35);
      expect(
        await graphElements.evaluateAll((els) => [
          ...new Set(els.map((el) => getComputedStyle(el).opacity)),
        ]),
      ).toEqual(["1"]);
      if (dark)
        await expect(
          page.getByRole("button", { name: /Switch to .* mode/ }),
        ).toHaveCount(0);
    }
  }
});

test("revealed payments use decision colors in dark mode without losing accessible labels", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await setPlaybackSpeed(page, 5);
  await expect(page.getByRole("status")).toContainText("Run complete");
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  const tray = page.getByRole("region", { name: "Run events" });
  await expect(tray.locator(".decision-approve")).toHaveCount(15);
  await expect(tray.locator(".decision-review")).toHaveCount(1);
  await expect(tray.locator(".decision-block")).toHaveCount(0);
  await expect(
    tray.getByRole("button", { name: "Inspect H01", exact: true }),
  ).toHaveClass(/decision-approve/);
  await expect(
    tray.getByRole("button", { name: "Inspect H07", exact: true }),
  ).toHaveClass(/decision-approve/);
  await expect(
    tray.getByRole("button", { name: "Inspect H10", exact: true }),
  ).toHaveClass(/decision-approve/);
  for (const theme of ["dark"]) {
    if (theme === "dark")
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
    expect(
      await tray
        .locator(".payment-result")
        .evaluateAll(
          (els) =>
            new Set(els.map((el) => getComputedStyle(el).backgroundColor)).size,
        ),
    ).toBe(2);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `../docs/screenshots/simulation-decisions-${theme}.png`,
    });
  }
});

test("invalid buffer prevents request; late and malformed responses cannot replace results", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/simulations")) requests++;
  });
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H10", exact: true }).click();
  await page.getByLabel("Amount · USD").fill("1e3");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("positive USD");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.route("**/api/v1/simulations", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.events[0].riskScore = 99;
    await route.fulfill({ response, json: body });
  });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    /inconsistent|Unknown detection path/i,
  );
  await expect(page.getByRole("button", { name: "Last run" })).toBeVisible();
  await page.unroute("**/api/v1/simulations");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  await page.route("**/api/v1/simulations", async (route) => {
    const response = await route.fetch();
    fetched();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await ready;
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H10", exact: true }).click();
  await page.getByLabel("Amount · USD").fill("12.34");
  release();
  await expect(page.getByLabel("Amount · USD")).toHaveValue("12.34");
  await expect(
    page.getByRole("main", { name: "RiskFlow graph workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeEnabled();
});

test("malformed metrics, future evidence and snapshot mismatches preserve the last run", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  for (const defect of ["rate", "truth", "evidence", "snapshot"]) {
    await page.route("**/api/v1/simulations", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (defect === "rate") body.metrics.flaggedRate.denominator = 15;
      if (defect === "truth")
        body.metrics.truthMetrics.blockedFraud.amountMinor++;
      if (defect === "evidence")
        body.events[0].model.detectionPaths.push("future-evidence");
      if (defect === "snapshot")
        body.scenarioSnapshot.nodes[0].name = "Wrong snapshot";
      await route.fulfill({ response, json: body });
    });
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      /inconsistent|Unknown detection path/i,
    );
    await expect(page.getByRole("button", { name: "Last run" })).toBeVisible();
    await page.unroute("**/api/v1/simulations");
  }
  await page.getByRole("button", { name: "Last run" }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toContainText("At this merchant");
});

test("replay is accessible in dark mode and works with reduced motion on mobile", async ({
  page,
}) => {
  const checkToolbar = async (name: string) => {
    const toolbar = page.getByRole("navigation", { name });
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(toolbar).toBeInViewport();
      const box = (await toolbar.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(1);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (await page.locator(".bottom-bar .camera").count()) {
        const camera = (await page
          .locator(".bottom-bar .camera")
          .boundingBox())!;
        const overlap =
          Math.max(
            0,
            Math.min(box.x + box.width, camera.x + camera.width) -
              Math.max(box.x, camera.x),
          ) *
          Math.max(
            0,
            Math.min(box.y + box.height, camera.y + camera.height) -
              Math.max(box.y, camera.y),
          );
        expect(overlap).toBe(0);
      }
    }
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await checkToolbar("Workspace tools");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  for (const theme of ["dark"]) {
    if (theme === "dark")
      await expect(
        page.getByRole("button", { name: /Switch to .* mode/ }),
      ).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../docs/screenshots/simulation-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Close explanation" }).click();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  const mobilePayments = page.getByRole("region", { name: "Run events" });
  const firstPayment = (await mobilePayments
    .getByRole("button", { name: "Inspect H01", exact: true })
    .boundingBox())!;
  const secondPayment = (await mobilePayments
    .getByRole("button", { name: "Inspect H02", exact: true })
    .boundingBox())!;
  const thirdPayment = (await mobilePayments
    .getByRole("button", { name: "Inspect H03", exact: true })
    .boundingBox())!;
  expect(firstPayment.y).toBe(secondPayment.y);
  expect(firstPayment.y).toBe(thirdPayment.y);
  expect(secondPayment.x).toBeGreaterThan(firstPayment.x + firstPayment.width);
  expect(thirdPayment.x).toBeGreaterThan(secondPayment.x + secondPayment.width);
  expect(thirdPayment.x + thirdPayment.width).toBeLessThanOrEqual(390);
  await expect(mobilePayments).not.toContainText(/\d{2}:\d{2}:\d{2}/);
  await page.getByRole("button", { name: "Close events" }).click();
  await setPlaybackPosition(page, -1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).not.toContainText("0/16 revealed");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Playback controls" })
      .getByRole("button", { name: "Clear board" }),
  ).toHaveCount(0);
  await checkToolbar("Playback controls");
  await page
    .getByRole("navigation", { name: "Playback controls" })
    .getByRole("button", { name: "Edit scenario" })
    .click();
  await expect(
    page.getByRole("button", { name: "Simulate", exact: true }),
  ).toBeVisible();
});

test("all playback settings advance 25 percent faster with the default still at 1x", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await setPlaybackPosition(page, -1);
  await expect(page.getByLabel("Playback speed")).toHaveValue("2");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  for (const speed of [0.25, 0.5, 1, 2, 5]) {
    await setPlaybackPosition(page, -1);
    await setPlaybackSpeed(page, speed);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.clock.runFor(640 / speed - 20);
    await expect(page.getByRole("status")).toContainText("0/16 revealed");
    await page.clock.runFor(40);
    await expect(page.getByRole("status")).toContainText("1/16 revealed");
  }
});

test("transaction pulses and risk highlights follow playback while inspection preserves the clock", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: /^Account Takeover/ }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await setPlaybackPosition(page, -1);
  await setPlaybackSpeed(page, 0.25);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const pulse = page.locator(".payment-pulse");
  await expect(pulse).toBeVisible();
  await expect(pulse.locator("circle")).toHaveCount(0);
  await expect(page.locator(".react-flow__node-object").first()).toHaveCSS(
    "filter",
    "grayscale(1)",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(pulse).toHaveCSS("color", "rgb(81, 229, 255)");
  await expect(page.locator(".react-flow__node-object").first()).toHaveCSS(
    "filter",
    "grayscale(0)",
  );
  const pausedStatus = await page.getByRole("status").textContent();
  await page
    .getByRole("button", { name: "Inspect payments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect ato-pay-04", exact: true })
    .click();
  await expect(page.locator('.status[role="status"]')).toHaveText(
    pausedStatus!,
  );
  await setPlaybackSpeed(page, 5);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Run complete");
  await expect(pulse).toHaveCount(0);
  await expect(
    page
      .locator('.react-flow__edge-path[style*="--transaction-review"]')
      .first(),
  ).toBeVisible();
  const fraudEdges = page.locator(
    '.react-flow__edge:has(.react-flow__edge-path[style*="--transaction-review"])',
  );
  const highlightedIds = await fraudEdges.evaluateAll((edges) =>
    edges.map((edge) => edge.getAttribute("data-id")),
  );
  const graph = page.locator(".react-flow__viewport");
  const beforeZoom = await graph.getAttribute("style");
  await page.mouse.move(550, 400);
  await page.mouse.wheel(0, -120);
  await expect(graph).not.toHaveAttribute("style", beforeZoom!);
  await fraudEdges.first().focus();
  await page.keyboard.press("Enter");
  const objectPanel = page.getByRole("complementary", {
    name: "Snapshot object details",
  });
  await expect(objectPanel).toBeVisible();
  const viewport = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await objectPanel
    .getByRole("button", { name: /ato-pay-/ })
    .first()
    .click();
  await expect(
    page.getByRole("complementary", { name: "Payment explanation" }),
  ).toBeVisible();
  await expect(page.locator('.status[role="status"]')).toContainText(
    "Run complete",
  );
  expect(
    await fraudEdges.evaluateAll((edges) =>
      edges.map((edge) => edge.getAttribute("data-id")),
    ),
  ).toEqual(highlightedIds);
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    viewport!,
  );
  await expect(pulse).toHaveCount(0);
  await setPlaybackPosition(page, -1);
  await expect(
    page.locator('.react-flow__edge-path[style*="--transaction-review"]'),
  ).toHaveCount(0);
  await expect(page.locator(".node-review-ring")).toHaveCount(0);
  await expect(pulse).toHaveCount(0);
});

test("grey transition carries from pending simulation into replay without flashing color", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/simulations", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".react-flow__node-object").first()).toHaveCSS(
    "filter",
    "grayscale(1)",
  );
  await page.evaluate(() => {
    const samples: number[] = [];
    const capture = () => {
      samples.push(
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--graph-saturation",
          ),
        ),
      );
      (window as unknown as { greyFrame: number }).greyFrame =
        requestAnimationFrame(capture);
    };
    (window as unknown as { greySamples: number[] }).greySamples = samples;
    capture();
  });
  release();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await expect(page.locator(".react-flow__node-object").first()).toHaveCSS(
    "filter",
    "grayscale(1)",
  );
  const minimum = await page.evaluate(() => {
    const w = window as unknown as { greyFrame: number; greySamples: number[] };
    cancelAnimationFrame(w.greyFrame);
    return Math.min(...w.greySamples);
  });
  expect(minimum).toBeGreaterThan(0.98);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--graph-saturation",
          ),
        ),
      ),
    )
    .toBe(0);
});
