import { expect, test } from "@playwright/test";
import type { components } from "../src/api/generated";

for (const file of ["unlabeled", "labeled"]) {
  test(`native ${file} card CSV imports all 10,000 rows with label-independent Upload-v9 predictions`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await page
      .getByLabel("CSV file")
      .setInputFiles(`../fixtures/evaluations/card-format-10000/${file}.csv`);
    await expect(page.getByText(/Card export detected:/)).toBeVisible();
    await page.getByRole("button", { name: "Preview graph" }).click();
    const preview = page.getByRole("region", { name: "Import preview" });
    await expect(preview).toContainText("10000 payments");
    await expect(preview).toContainText("assumed UTC");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Build graph" }).click();
    let resolveRun!: (value: components["schemas"]["RunResult"]) => void;
    let rejectRun!: (reason: unknown) => void;
    const response = new Promise<components["schemas"]["RunResult"]>(
      (resolve, reject) => {
        resolveRun = resolve;
        rejectRun = reject;
      },
    );
    // Read large responses before Chrome evicts them from its inspector cache.
    await page.route("**/api/v1/simulations", async (route) => {
      try {
        const received = await route.fetch();
        expect(received.ok()).toBe(true);
        resolveRun(await received.json());
        await route.fulfill({ response: received });
      } catch (error) {
        rejectRun(error);
      }
    });
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    const result = await response;
    expect(result.events).toHaveLength(10000);
    expect(
      new Set(result.events.map((e: { accountId: string }) => e.accountId))
        .size,
    ).toBe(136);
    expect(result.metrics.labeledCount).toBe(file === "labeled" ? 10000 : 0);
    expect(result.engineVersion).toBe("engine-ml-upload-v9");
    const replay = await page.request.post("/api/v1/simulations", {
      data: {
        scenario: {
          ...result.scenarioSnapshot,
          groundTruth: {},
          payments: [...result.scenarioSnapshot.payments].reverse(),
        },
      },
    });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).events).toEqual(result.events);
    expect(result.events[0].occurredAt).toBe("2018-01-01T08:04:00.000Z");
    await expect(
      page.getByRole("main", { name: "RiskFlow run snapshot" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Inspect payments", exact: true })
      .click();
    await expect(page.getByRole("status")).not.toContainText(
      "missing model inputs",
    );
  });
}
