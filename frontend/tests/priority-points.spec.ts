import { test, expect } from "@playwright/test";
import { rankedQueue } from "../src/domain/reviewQueue";
import type { Run } from "../src/domain/runs";

test("CSV points reconcile above, at and below the middle; failed reference retries and caches", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByLabel("CSV file")
    .setInputFiles(
      process.env.RISKFLOW_TEST_CSV ?? "public/samples/ibm/online-episode.csv",
    );
  const prepared = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/simulations"),
  );
  await page.getByRole("button", { name: "Preview graph" }).click();
  const run = (await (await prepared).json()) as Run;
  const ids = new Map(
    run.scenarioSnapshot.payments.map((p) => [
      p.id,
      p.rankingInput?.sourcePaymentId ?? p.id,
    ]),
  );
  const queue = rankedQueue(run.events, ids);
  const middle = queue.middle!;
  let referenceRequests = 0;
  await page.route("**/api/v1/explanations", async (route) => {
    const body = route.request().postDataJSON();
    if (body.eventId === middle.eventId && ++referenceRequests === 1) {
      await route.fulfill({
        status: 503,
        json: { error: { message: "Temporary failure" } },
      });
      return;
    }
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: data });
  });
  await page.getByRole("button", { name: "Build graph" }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const panel = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  const inspect = async (id: string) => {
    if (await panel.isVisible())
      await page
        .getByRole("button", { name: "Close explanation", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Inspect payments", exact: true })
      .click();
    await page.getByLabel("Find payment", { exact: true }).fill(id);
    await page
      .getByRole("button", { name: `Inspect ${id}`, exact: true })
      .click();
  };
  const selected = queue.ordered[0]!;
  await inspect(ids.get(selected.eventId)!);
  await expect(panel).toContainText("Explanation unavailable");
  await expect(panel.locator(".probability-plot")).toHaveCount(0);
  await panel.getByRole("button", { name: "Retry", exact: true }).click();
  for (const event of [selected, middle, queue.ordered.at(-1)!]) {
    if (event !== selected) await inspect(ids.get(event.eventId)!);
    await expect(
      panel.getByRole("figure", { name: "How checks change priority points" }),
    ).toBeVisible();
    const values = (
      await panel.locator(".priority-comparison strong").allTextContents()
    ).map(parseFloat);
    const selectedTenths = Math.round(
      (event.model!.ranking!.rawMargin - middle.model!.ranking!.rawMargin) *
        100,
    );
    expect(values).toEqual([selectedTenths / 10]);
    const changes = (
      await panel.locator(".priority-contribution").allTextContents()
    ).map(parseFloat);
    expect(Math.round(changes.reduce((sum, n) => sum + n, 0) * 10)).toBe(
      selectedTenths,
    );
    expect(await panel.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    if (event === selected) {
      await page.screenshot({
        path: testInfo.outputPath("points-summary.png"),
      });
      await panel.locator(".priority-check-list").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath("points-breakdown.png"),
      });
    }
    await expect(panel).not.toContainText(
      /Score difference|Raises priority|Lowers priority|About these comparisons|Raised this check|Check total|Middle payment/,
    );
    expect(
      (
        await panel.locator(".priority-input-comparison").allTextContents()
      ).join(" "),
    ).not.toMatch(/This:|Middle:|prior observations/);
    const remaining = panel.locator(".remaining-factors");
    await remaining.locator("summary").click();
    const remainingPoints = (
      await remaining.locator(".remaining-factor-list strong").allTextContents()
    ).map(parseFloat);
    const remainingTotal = parseFloat(
      (await remaining.locator(".priority-contribution").textContent())!,
    );
    expect(Math.round(remainingPoints.reduce((s, n) => s + n, 0) * 10)).toBe(
      Math.round(remainingTotal * 10),
    );
    await remaining.locator("summary").click();
    const zeroLine = panel.locator(".plot-zero");
    await expect(zeroLine).toHaveAttribute("y1", "84");
    const bars = panel.locator(".probability-plot rect:not(.cutoff-label-bg)");
    await expect(panel.locator(".plot-connector")).toHaveCount(4);
    const waterSteps = await bars.evaluateAll((elements) =>
      elements.slice(0, -1).map((e) => ({
        y: Number(e.getAttribute("y")),
        height: Number(e.getAttribute("height")),
      })),
    );
    if (changes.some((value) => value !== 0))
      expect(
        waterSteps
          .slice(1)
          .some((row) => row.y !== 84 && row.y + row.height !== 84),
      ).toBe(true);
    const totalBar = bars.last();
    const cutoff = panel.locator(".priority-review-cutoff");
    const expectedCutoff = Math.round(
      (queue.ordered[queue.suggestion.count - 1]!.model!.ranking!.rawMargin -
        middle.model!.ranking!.rawMargin) *
        100,
    );
    const chartLimit =
      Math.abs(
        parseFloat(
          (await panel
            .locator(".probability-plot .plot-axis")
            .first()
            .textContent())!,
        ),
      ) * 10;
    if (Math.abs(expectedCutoff) <= chartLimit) {
      await expect(cutoff).toHaveAttribute(
        "data-score",
        String(expectedCutoff),
      );
      const totalCenter =
        Number(await totalBar.getAttribute("x")) +
        Number(await totalBar.getAttribute("width")) / 2;
      const marker = cutoff.locator("line");
      expect(Number(await marker.getAttribute("x1"))).toBe(totalCenter - 20);
      expect(Number(await marker.getAttribute("x2"))).toBe(totalCenter + 20);
      for (const label of await cutoff.locator("text").all()) {
        const box = await label.evaluate((e) => {
          const { x, y, width, height } = (e as SVGGraphicsElement).getBBox();
          return { x, y, width, height };
        });
        expect(box.x).toBeGreaterThan(totalCenter + 20);
        expect(box.x + box.width).toBeLessThanOrEqual(344);
        expect(box.y).toBeGreaterThanOrEqual(16);
        expect(box.y + box.height).toBeLessThanOrEqual(152);
      }
      await expect(cutoff.locator("rect")).toHaveCount(0);
    } else {
      await expect(cutoff).toHaveCount(0);
    }
    if (selectedTenths > 0)
      expect(Number(await totalBar.getAttribute("y"))).toBeLessThan(84);
    if (selectedTenths < 0)
      expect(Number(await totalBar.getAttribute("y"))).toBe(84);
    if (selectedTenths === 0)
      await expect(totalBar).toHaveAttribute("height", "0");
    const scoreColor = await panel
      .locator(".selected-priority-score strong")
      .evaluate((e) => getComputedStyle(e).color);
    const expectedColor = await page.evaluate(
      (review) => {
        const probe = document.createElement("span");
        probe.style.color = review
          ? "var(--transaction-review)"
          : "var(--approve)";
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      },
      queue.ranks.get(event.eventId)! <= queue.suggestion.count,
    );
    expect(scoreColor).toBe(expectedColor);
    if (event === selected) {
      const summaries = panel.locator(".expert-observations summary");
      const names = await summaries.allTextContents();
      expect(new Set(names).size).toBe(names.length);
      for (const summary of await summaries.all()) {
        await summary.click();
        const contributions = summary
          .locator("..")
          .locator(".check-contributions");
        const rows = contributions.locator(".contribution-rows > li");
        expect(await rows.count()).toBeGreaterThanOrEqual(1);
        expect(await rows.count()).toBeLessThanOrEqual(4);
        await expect(rows.last()).toContainText("Other context");
        const children = (
          await contributions.locator(".check-points").allTextContents()
        ).map(parseFloat);
        const parent = parseFloat(
          (await summary.locator(".priority-contribution").textContent())!,
        );
        expect(Math.round(children.reduce((sum, n) => sum + n, 0) * 10)).toBe(
          Math.round(parent * 10),
        );
        await expect(summary.locator(".priority-contribution")).toHaveCount(1);
        const observed = children.slice(0, -1).map(Math.abs);
        expect(observed).toEqual([...observed].sort((a, b) => b - a));
        expect(
          await panel.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
      }
      const geometry = await panel
        .locator(".contribution-row")
        .evaluateAll((elements) =>
          elements.map((el) => {
            const points = Number(
              el.querySelector(".check-points")!.textContent,
            );
            const track = el
              .querySelector(".contribution-track")!
              .getBoundingClientRect();
            const bar = el
              .querySelector(".contribution-fill")!
              .getBoundingClientRect();
            return {
              points,
              start: bar.x - track.x,
              end: bar.right - track.x,
              width: bar.width,
              center: track.width / 2,
              trackWidth: track.width,
            };
          }),
        );
      const scaleRatios: number[] = [];
      for (const bar of geometry) {
        if (bar.points > 0) expect(bar.start).toBeCloseTo(bar.center, 0);
        if (bar.points < 0) expect(bar.end).toBeCloseTo(bar.center, 0);
        if (bar.points === 0) expect(bar.width).toBe(0);
        if (Math.abs(bar.points) >= 1)
          scaleRatios.push(bar.width / bar.trackWidth / Math.abs(bar.points));
      }
      expect(Math.max(...scaleRatios) - Math.min(...scaleRatios)).toBeLessThan(
        0.001,
      );
      await expect(panel.locator("button.contribution-row")).toHaveCount(0);
      await expect(panel.locator(".shared-observation")).toHaveCount(0);
      await panel
        .locator(".expert-observations summary")
        .first()
        .scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await panel.screenshot({
        path: testInfo.outputPath("check-details.png"),
      });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await panel.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: testInfo.outputPath("check-details-mobile.png"),
      });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }
  expect(referenceRequests).toBe(2);
  const capacity = page.getByRole("slider", {
    name: "Review capacity",
    exact: true,
  });
  await capacity.press("End");
  await expect(capacity).toHaveValue(String(queue.ordered.length));
  await expect(panel.locator(".priority-total")).toHaveClass(
    /payment-score-review/,
  );
  expect(
    await panel.locator(".priority-review-cutoff line").getAttribute("y1"),
  ).toBe(await panel.locator(".priority-total-cap").getAttribute("y1"));
  await capacity.press("Home");
  await expect(panel.locator(".priority-review-cutoff")).toHaveCount(0);
  await expect(panel.locator(".priority-total")).toHaveClass(
    /payment-score-clear/,
  );
  // Capacity must never change the selected payment's axis or bar geometry.
  await inspect(ids.get(middle.eventId)!);
  await expect(panel.locator(".probability-plot")).toBeVisible();
  const geometry = () =>
    panel
      .locator(".probability-plot rect:not(.cutoff-label-bg)")
      .evaluateAll((bars) =>
        bars.map((bar) => ({
          y: bar.getAttribute("y"),
          height: bar.getAttribute("height"),
        })),
      );
  const before = await geometry();
  const axes = await panel
    .locator(".probability-plot .plot-axis")
    .allTextContents();
  await capacity.press("ArrowLeft");
  await expect(capacity).toHaveValue("1");
  await expect(panel.locator(".priority-review-cutoff")).toHaveCount(0);
  expect(await geometry()).toEqual(before);
  expect(
    await panel.locator(".probability-plot .plot-axis").allTextContents(),
  ).toEqual(axes);
  // The label stays beside the highest payment's marker, clear of its red bar.
  await inspect(ids.get(selected.eventId)!);
  const topMarker = panel.locator(".priority-review-cutoff");
  await expect(topMarker).toBeVisible();
  const markerY = Number(await topMarker.locator("line").getAttribute("y1"));
  expect(
    Number(await topMarker.locator("text").first().getAttribute("y")),
  ).toBeGreaterThan(markerY);
  expect(Number(await topMarker.locator("text").getAttribute("x"))).toBe(
    Number(await topMarker.locator("line").getAttribute("x2")) + 6,
  );
  await expect(topMarker.locator("rect")).toHaveCount(0);
  await panel
    .locator(".probability-plot")
    .screenshot({ path: testInfo.outputPath("cutoff-label-right.png") });
});
