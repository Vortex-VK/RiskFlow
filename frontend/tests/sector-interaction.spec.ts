import { openExampleWorkspace, setReviewCapacity } from "./workspace-helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Document } from "../src/domain/types";

test("sectors are fixed: dragging pans, clicking enters, keyboard navigation and accessibility work", async ({
  page,
}) => {
  const document = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  const payments = document.scenario.payments;
  document.scenario.payments = Array.from({ length: 48 }, (_, i) => ({
    ...payments[i % payments.length]!,
    id: `fixed-${i}`,
  }));
  document.scenario.groundTruth = {};
  await page.route("**/api/v1/templates/shared-device-cluster", (r) =>
    r.fulfill({ json: document }),
  );
  await openExampleWorkspace(page);
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const nodes = () =>
    page.locator(".react-flow__node").evaluateAll((items) =>
      items.map((n) => ({
        id: n.getAttribute("data-id"),
        transform: (n as HTMLElement).style.transform,
      })),
    );
  const original = await nodes();
  expect(original.length).toBeGreaterThan(0);
  const viewport = page.locator(".react-flow__viewport");
  const before = await viewport.getAttribute("style");
  const target = page.locator(".transaction-sector").first();
  const name = target.locator(".sector-name");
  const box = (await name.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 100,
    box.y + box.height / 2 + 45,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    "all",
  );
  await expect(viewport).not.toHaveAttribute("style", before!);
  expect(await nodes()).toEqual(original);
  await page.mouse.wheel(0, -120);
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    "all",
  );
  await page.waitForTimeout(400);
  const moved = (await name.boundingBox())!;
  await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2);
  await expect(page.getByTestId("cluster-overview")).not.toHaveAttribute(
    "data-group",
    "all",
  );
  await page.getByRole("button", { name: "All payments", exact: true }).click();
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
});

test("cluster names zoom while review badges open only that cluster's visible review payments", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await page
    .getByRole("button", { name: "Open in workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "RiskFlow run snapshot" }),
  ).toBeVisible();
  await setReviewCapacity(page, 40);
  await page.evaluate(async () => {
    const { useSimulation } = await import("/src/state/simulation.ts");
    useSimulation.setState({ elapsed: 1e9, playing: false });
  });
  await expect(page.locator(".sector-review-count").first()).toBeVisible();
  const expectedIds = async (id: string, capacity: number) =>
    page.evaluate(
      async ({ id, capacity }) => {
        const { useSimulation } = await import("/src/state/simulation.ts");
        const { buildHierarchy } = await import("/src/domain/hierarchy.ts");
        const { rankedQueue } = await import("/src/domain/reviewQueue.ts");
        const captured = useSimulation.getState().latest!;
        const root = buildHierarchy(
          structuredClone(captured.document.scenario),
        );
        const group = root.children.find((g) => g.id === id)!;
        const ids = new Set(group.payments.map((p) => p.id));
        const sourceIds = new Map(
          captured.document.scenario.payments.map((p) => [
            p.id,
            p.rankingInput?.sourcePaymentId ?? p.id,
          ]),
        );
        return rankedQueue(captured.result.events, sourceIds)
          .ordered.slice(0, capacity)
          .filter((e) => ids.has(e.eventId))
          .map((e) => `Inspect ${sourceIds.get(e.eventId)}`);
      },
      { id, capacity },
    );
  for (const index of [0, 1]) {
    const cluster = page
      .locator(".transaction-sector:has(.sector-review-count)")
      .nth(index);
    await cluster.focus();
    const geometry = await cluster.evaluate((el) => {
      const cluster = el.getBoundingClientRect();
      const label = el.querySelector(".sector-name")!.getBoundingClientRect();
      return {
        clusterY: cluster.y + cluster.height / 2,
        labelY: label.y + label.height / 2,
      };
    });
    expect(geometry.labelY).toBeCloseTo(geometry.clusterY, 0);
    const group = await cluster
      .locator(".territory-hit")
      .getAttribute("data-sector");
    const count = Number(await cluster.getAttribute("data-review-count"));
    const camera = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    const target = cluster.locator(".sector-review-count");
    if (index === 0) await target.click();
    else await target.press("Enter");
    const list = page.getByRole("region", { name: "Run events" });
    await expect(list.locator(".payment-result")).toHaveCount(count);
    expect(
      await list
        .locator(".payment-result")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("aria-label")!),
        ),
    ).toEqual(await expectedIds(group!, 40));
    await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
      "data-group",
      "all",
    );
    await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
      "style",
      camera!,
    );
    expect(
      await page.evaluate(
        async () =>
          (await import("/src/state/simulation.ts")).useSimulation.getState()
            .playing,
      ),
    ).toBe(false);
    if (index === 1) {
      await setReviewCapacity(page, 50);
      const expected = await expectedIds(group!, 50);
      await expect(list.locator(".payment-result")).toHaveCount(
        expected.length,
      );
      expect(
        await list
          .locator(".payment-result")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getAttribute("aria-label")!),
          ),
      ).toEqual(expected);
      await page
        .getByRole("button", { name: "50 need review — inspect flagged payments", exact: true })
        .click();
      await expect(list.locator(".payment-result")).toHaveCount(50);
      expect(
        (await list.locator(".payment-result").allTextContents()).map(
          (text) => Number(text.match(/#(\d+) of/)![1]),
        ),
      ).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    }
    await page
      .getByRole("button", { name: "Close events", exact: true })
      .click();
    if (index === 0) {
      await cluster.locator(".sector-factor-label").click();
      await expect(
        page.locator('[data-testid="cluster-overview"][data-group="all"]'),
      ).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: "Transaction groups" }),
      ).toBeVisible();
      expect(group).toBeTruthy();
      await page
        .getByRole("button", { name: "All payments", exact: true })
        .click();
      await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
        "data-group",
        "all",
      );
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("cluster-labels.png") });
});
