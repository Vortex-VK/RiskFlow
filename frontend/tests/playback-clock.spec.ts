import { expect, test } from "@playwright/test";
import { openExampleWorkspace, setPlaybackPosition } from "./workspace-helpers";

test("playback advances while hidden, catches up after throttling, and respects an explicit pause", async ({
  page,
}) => {
  await openExampleWorkspace(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".replay")).toBeVisible();
  await setPlaybackPosition(page, -1);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const hidden = (value: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => value,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, value);
  const elapsed = () =>
    page.evaluate(async () => {
      const { useSimulation } = await import("/src/state/simulation.ts");
      return useSimulation.getState().elapsed;
    });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await hidden(true);
  await page.clock.runFor(1000);
  expect(await elapsed()).toBeGreaterThan(1000);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  // Simulate a background tab whose timers only wake after a long delay.
  await page.clock.fastForward(10000);
  await hidden(false);
  await expect(page.locator(".replay")).toHaveAttribute(
    "data-playback-complete",
    "true",
  );

  await setPlaybackPosition(page, -1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await hidden(true);
  await page.clock.runFor(500);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedAt = await elapsed();
  await page.clock.fastForward(5000);
  await hidden(false);
  expect(await elapsed()).toBe(pausedAt);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});
