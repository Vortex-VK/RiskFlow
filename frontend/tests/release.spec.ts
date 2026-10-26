import { openExampleWorkspace } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import type { Document } from "../src/domain/types";

test("idle surfaces move while centers, labels, edges and history stay still; reduced motion stops and resumes them", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  const body = page.locator('[data-node="account-a"] .node-body');
  const stableGeometry = () =>
    page.evaluate(() => ({
      nodes: [...document.querySelectorAll(".react-flow__node")].map((n) =>
        n.getAttribute("style"),
      ),
      labels: [
        ...document.querySelectorAll(".react-flow__node svg > text"),
      ].map((n) => {
        const r = n.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
      edges: [...document.querySelectorAll(".react-flow__edge-path")].map((n) =>
        n.getAttribute("d"),
      ),
    }));
  const geometry = await stableGeometry();
  expect(geometry.labels).toHaveLength(15);
  expect(geometry.edges).toHaveLength(21);
  const initial = await body.getAttribute("d");
  await expect(body).not.toHaveAttribute("d", initial!);
  await page.waitForTimeout(700);
  expect(await stableGeometry()).toEqual(geometry);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  const trayBody = page.locator('[data-node="tray-account"] .node-body');
  const trayInitial = await trayBody.getAttribute("d");
  await expect(trayBody).not.toHaveAttribute("d", trayInitial!);
  const surface = page.getByRole("region", { name: "Add objects" });
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await expect(surface).toHaveCSS("background-color", "rgb(36, 36, 36)");
  await page.screenshot({ path: "../docs/screenshots/release-tray-dark.png" });
  await page.getByRole("button", { name: "About this workspace" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Animate objects" }),
  ).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const rest = await body.getAttribute("d");
  await page.waitForTimeout(350);
  await expect(body).toHaveAttribute("d", rest!);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(body).not.toHaveAttribute("d", rest!);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(body).toHaveAttribute("d", rest!);
  await page.waitForTimeout(350);
  await expect(body).toHaveAttribute("d", rest!);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(body).not.toHaveAttribute("d", rest!);
  await page.reload();
  await expect(page.getByRole("button", { name: "Payments 0" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("sixty-payment scenario detail stays responsive and warm simulation timing is recorded", async ({
  page,
  browserName,
  browser,
}) => {
  const document = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  const merchant = document.scenario.nodes.find((n) => n.type === "merchant")!;
  for (let i = 0; i < 20; i++)
    document.scenario.nodes.push({
      ...merchant,
      id: `extra-${i}`,
      name: `Merchant ${i + 1}`,
    });
  document.scenario.nodes.forEach((n, i) => {
    document.view.positions[n.id] = {
      x: 230 + (i % 7) * 150,
      y: 190 + Math.floor(i / 7) * 140,
    };
  });
  for (let i = 0; i < 44; i++)
    document.scenario.payments.push({
      ...document.scenario.payments[0]!,
      id: `extra-payment-${i}`,
      merchantId: `extra-${i % 20}`,
    });
  await page.route("**/api/v1/templates/shared-device-cluster", (route) =>
    route.fulfill({ json: document }),
  );
  await openExampleWorkspace(page);
  await expect(page.getByTestId("cluster-overview")).toBeVisible();
  await page.getByRole("button", { name: /Payments 60/ }).click();
  await page.getByRole("button", { name: "Payment H01", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Transaction groups" }),
  ).toContainText("interactive detail");
  await page.getByRole("button", { name: "Fit network to canvas" }).click();
  await page.waitForTimeout(300);
  const metricsPromise = page.evaluate(
    () =>
      new Promise<{
        frameP95: number;
        longTasks: number[];
        longTasksSupported: boolean;
        frames: number;
        animationCallbackMs: number;
        measuredMs: number;
      }>((resolve) => {
        const frames: number[] = [];
        const longTasks: number[] = [];
        const supported =
          PerformanceObserver.supportedEntryTypes.includes("longtask");
        const observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longTasks.push(e.duration);
        });
        if (supported) observer.observe({ type: "longtask" });
        const start = performance.now();
        const originalFrame = window.requestAnimationFrame;
        let animationCallbackMs = 0;
        window.requestAnimationFrame = (callback) =>
          originalFrame.call(window, (time) => {
            const before = performance.now();
            callback(time);
            animationCallbackMs += performance.now() - before;
          });
        let last = start;
        const tick = (now: number) => {
          frames.push(now - last);
          last = now;
          if (now - start < 4000) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            window.requestAnimationFrame = originalFrame;
            frames.sort((a, b) => a - b);
            resolve({
              frameP95: frames[Math.floor(frames.length * 0.95)]!,
              longTasks,
              longTasksSupported: supported,
              frames: frames.length,
              animationCallbackMs,
              measuredMs: now - start,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  const hit = page.locator('[data-node="account-a"] .node-hit');
  const box = (await hit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 40; i++)
    await page.mouse.move(
      box.x + box.width / 2 + i * 3,
      box.y + box.height / 2 + Math.sin(i / 6) * 30,
    );
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await page.mouse.move(1300, 700);
  await page.mouse.down();
  await page.mouse.move(1230, 660, { steps: 20 });
  await page.mouse.up();
  const metrics = await metricsPromise;
  const timings: number[] = [];
  for (let i = 0; i < 21; i++) {
    const start = performance.now();
    const result = await page.request.post("/api/v1/simulations", {
      data: { scenario: document.scenario },
    });
    expect(result.status()).toBe(200);
    expect((await result.json()).events).toHaveLength(60);
    if (i) timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const evidence = {
    browser: browser.version(),
    browserName,
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model,
    nodes: 35,
    payments: 60,
    ...metrics,
    warmApiMedianMs: timings[10],
    warmApiP95Ms: timings[19],
    samples: 20,
  };
  await writeFile(
    `../docs/performance-${browserName}.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  expect(metrics.frames).toBeGreaterThan(40);
  expect(metrics.frameP95).toBeLessThan(50);
  if (metrics.longTasksSupported)
    expect(metrics.longTasks.filter((ms) => ms > 50).length).toBeLessThan(4);
  expect(timings[19]).toBeLessThan(500);
});
