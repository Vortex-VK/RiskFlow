import { test, expect } from "@playwright/test";
import { openExampleWorkspace, syntheticModelCsv } from "./workspace-helpers";

test("dense transaction replay stays lightweight", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "synthetic-model-inputs.csv",
    mimeType: "text/csv",
    buffer: await syntheticModelCsv(
      "../fixtures/imports/riskflow_transactions_l_9000.csv",
    ),
  });
  await page.getByRole("button", { name: "Preview graph" }).click();
  await page.getByRole("button", { name: "Build graph" }).click();
  await expect(page.locator(".graph-stage")).not.toHaveClass(/graph-reveal/, {
    timeout: 8000,
  });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  const metrics = await page.evaluate(
    () =>
      new Promise<{ frames: number; median: number; p95: number; dom: number }>(
        (resolve) => {
          const intervals: number[] = [];
          const start = performance.now();
          let previous = start;
          function frame(now: number) {
            intervals.push(now - previous);
            previous = now;
            if (now - start < 5000) requestAnimationFrame(frame);
            else {
              intervals.sort((a, b) => a - b);
              resolve({
                frames: intervals.length,
                median: intervals[Math.floor(intervals.length / 2)]!,
                p95: intervals[Math.floor(intervals.length * 0.95)]!,
                dom: document.querySelectorAll(".hierarchy-stage *").length,
              });
            }
          }
          requestAnimationFrame(frame);
        },
      ),
  );
  await expect(page.locator("canvas.transaction-canvas")).toHaveCount(2);
  await expect(page.locator(".hierarchy-stage .payment-pulse")).toHaveCount(0);
  expect(metrics.dom).toBeLessThan(150);
  expect(metrics.p95).toBeLessThan(100);
  console.log("Dense replay metrics:", JSON.stringify(metrics));
  await testInfo.attach("frame-metrics", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  await page.screenshot({
    path: "../docs/screenshots/transaction-rendering.png",
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const current = page.locator(".transaction-current");
  const overviewBoost = Number(
    await current.getAttribute("data-overview-boost"),
  );
  expect(overviewBoost).toBeGreaterThan(0);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -220);
  await expect
    .poll(async () => Number(await current.getAttribute("data-overview-boost")))
    .toBeLessThan(overviewBoost);
  await page.screenshot({
    path: "../docs/screenshots/transaction-rendering-zoomed.png",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".transaction-current")).toBeHidden();
  await expect(page.locator(".transaction-risk")).toBeVisible();
});
