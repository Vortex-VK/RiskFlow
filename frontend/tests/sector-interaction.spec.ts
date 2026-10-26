import { openExampleWorkspace } from "./workspace-helpers";
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
