import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import catalog from "../src/features/samples/catalog.json" with { type: "json" };

test("sample library is dismissible, responsive and downloadable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Build your scenario", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start with a sample." });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Open card-review demo" }),
  ).toHaveCount(0);
  await expect(
    dialog.locator(
      "details, .sample-tag, .sample-format, .sample-period, .sample-option-arrow",
    ),
  ).toHaveCount(0);
  await expect(dialog).not.toContainText(
    /Upload-v\d|What to explore|Source & assumptions/,
  );
  await expect(dialog.getByRole("button", { pressed: true })).toContainText(
    "Card fraud across accounts",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const sample of catalog.samples) {
    await dialog
      .getByRole("button", { name: new RegExp(sample.title) })
      .click();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
      sample.title,
    );
    const results = dialog.getByRole("region", { name: "Sample results" });
    await expect(results).toBeVisible();
    await expect(results.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      String((sample.alertCount / sample.rows) * 100),
    );
    await expect(results).toContainText(
      `${sample.metrics.truePositive} / ${sample.fraudCount}`,
    );
    const downloadEvent = page.waitForEvent("download");
    await dialog.getByRole("link", { name: "Download CSV" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(`riskflow-ibm-${sample.file}`);
    expect(
      createHash("sha256")
        .update(readFileSync((await download.path())!))
        .digest("hex"),
    ).toBe(sample.sha256);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Close sample library" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

for (const sample of catalog.samples) {
  test(`${sample.rows} IBM transactions load and reproduce the recorded live Upload-v9 results`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/");
    await page.getByRole("button", { name: "Samples", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: new RegExp(sample.title) })
      .click();
    await dialog.getByRole("button", { name: "Open in workspace" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `Payments ${sample.rows}`,
        exact: true,
      }),
    ).toBeVisible();
    let resolveRun!: (run: unknown) => void;
    let rejectRun!: (cause: unknown) => void;
    const response = new Promise((resolve, reject) => {
      resolveRun = resolve;
      rejectRun = reject;
    });
    await page.route("**/api/v1/simulations", async (route) => {
      try {
        const result = await route.fetch();
        expect(result.ok()).toBe(true);
        resolveRun(await result.json());
        await route.fulfill({ response: result });
      } catch (cause) {
        rejectRun(cause);
      }
    });
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    const run =
      (await response) as import("../src/api/generated").components["schemas"]["RunResult"];
    expect(run.engineVersion).toBe("engine-ml-upload-v9");
    expect(run.events).toHaveLength(sample.rows);
    const counts = {
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
      trueNegative: 0,
    };
    const expected = JSON.parse(
      readFileSync(`../${catalog.resultsDirectory}/${sample.id}.json`, "utf8"),
    ) as { eventId: string; alert: boolean; fraud: boolean }[];
    const predictions = new Map<string, boolean>(
      run.events.map((event) => [event.eventId, event.model!.alert]),
    );
    for (const event of expected) {
      const alert = predictions.get(event.eventId);
      expect(alert).toBe(event.alert);
      expect(run.scenarioSnapshot.groundTruth[event.eventId]).toBe(
        event.fraud ? "fraudulent" : "legitimate",
      );
      counts[
        event.fraud
          ? alert
            ? "truePositive"
            : "falseNegative"
          : alert
            ? "falsePositive"
            : "trueNegative"
      ]++;
    }
    expect(counts).toEqual(sample.metrics);
    if (sample.rows === 50) {
      const unlabeled = await page.request.post("/api/v1/simulations", {
        data: { scenario: { ...run.scenarioSnapshot, groundTruth: {} } },
      });
      expect(unlabeled.ok()).toBe(true);
      const withoutLabels = await unlabeled.json();
      expect(
        withoutLabels.events.map((event: { model: unknown }) => event.model),
      ).toEqual(run.events.map((event) => event.model));
      expect(withoutLabels.metrics.labeledCount).toBe(0);
    }
    await expect(
      page.getByRole("main", { name: "RiskFlow run snapshot" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Payments 0", exact: true }),
    ).toBeVisible();
  });
}

test("a failed or cancelled sample load leaves the workspace intact", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/samples/ibm/online-episode.csv", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Open in workspace" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "could not be downloaded",
  );
  await dialog.getByRole("button", { name: "Close sample library" }).click();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await page.unroute("**/samples/ibm/online-episode.csv");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/samples/ibm/online-episode.csv", async (route) => {
    await pending;
    await route.fulfill({
      path: "public/samples/ibm/online-episode.csv",
      contentType: "text/csv",
    });
  });
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  const requested = page.waitForRequest("**/samples/ibm/online-episode.csv");
  await dialog.getByRole("button", { name: "Open in workspace" }).click();
  await requested;
  await dialog.getByRole("button", { name: "Close sample library" }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Payments 0", exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test("samples respect edited work and remain available from CSV import", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByRole("button", { name: /Browse IBM samples/ }).click();
  const library = page.getByRole("dialog", { name: "Start with a sample." });
  await library.getByRole("button", { name: /First five payments/ }).click();
  await library.getByRole("button", { name: "Open in workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Payments 5", exact: true }),
  ).toBeVisible();
  await page.locator(".react-flow__node").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await library.getByRole("button", { name: "Open in workspace" }).click();
  const replace = page.getByRole("dialog", { name: "Replace this workspace?" });
  await expect(replace).toBeVisible();
  await replace.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Payments 5", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await library.getByRole("button", { name: "Open in workspace" }).click();
  await replace.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Payments 250", exact: true }),
  ).toBeVisible();
});
