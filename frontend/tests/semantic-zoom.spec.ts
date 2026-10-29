import {
  addIndependentActivity,
  openExampleWorkspace,
} from "./workspace-helpers";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Document } from "../src/domain/types";
async function fixture(page: Page) {
  const document = JSON.parse(
    await readFile("../fixtures/scenarios/shared-device-cluster.json", "utf8"),
  ) as Document;
  const payments = document.scenario.payments;
  document.scenario.payments = Array.from({ length: 48 }, (_, i) => ({
    ...payments[i % payments.length]!,
    id: `zoom-${i}`,
  }));
  document.scenario.groundTruth = {};
  addIndependentActivity(document);
  await page.route("**/api/v1/templates/shared-device-cluster", (r) =>
    r.fulfill({ json: document }),
  );
  await openExampleWorkspace(page);
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await page.waitForTimeout(300);
}
const zoom = (page: Page) =>
  page
    .locator(".react-flow__viewport")
    .evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).a);

test("small scroll magnifies; sustained scroll enters the sector under the pointer without fitting the camera", async ({
  page,
}) => {
  await fixture(page);
  const target = page.locator('.transaction-sector[data-leaf="false"]').first();
  const id = (await target
    .locator("[data-sector]")
    .getAttribute("data-sector"))!;
  const box = (await target.locator(".sector-name").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await zoom(page);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    "all",
  );
  expect(await zoom(page)).toBeGreaterThan(before);
  for (let i = 0; i < 14; i++) {
    if (
      (await page
        .getByTestId("cluster-overview")
        .getAttribute("data-group")) !== "all"
    )
      break;
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    id,
  );
  const entered = await zoom(page);
  await page.waitForTimeout(400);
  expect(await zoom(page)).toBeCloseTo(entered, 4);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    id,
  );
});

test("zooming out of final detail returns to its parent, while one scroll stays in detail", async ({
  page,
}) => {
  await fixture(page);
  await page
    .locator('.transaction-sector[data-leaf="true"]')
    .first()
    .press("Enter");
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-detail",
    "true",
  );
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await page.waitForTimeout(300);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(400);
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-detail",
    "true",
  );
  for (let i = 0; i < 12; i++) {
    if (
      (await page.locator(".hierarchy-stage").getAttribute("data-detail")) ===
      "false"
    )
      break;
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    "all",
  );
  const before = await zoom(page);
  await page.waitForTimeout(300);
  expect(await zoom(page)).toBeCloseTo(before, 4);
});

test("wheel zoom returns from detail to the overview without a Fit control", async ({
  page,
}) => {
  await fixture(page);
  await page
    .locator('.transaction-sector[data-leaf="true"]')
    .first()
    .press("Enter");
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-transitioning",
    "false",
  );
  await page.waitForTimeout(300);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);
  await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
    "data-detail",
    "true",
  );
  for (let i = 0; i < 9; i++) {
    if (
      (await page.locator(".hierarchy-stage").getAttribute("data-detail")) ===
      "false"
    )
      break;
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(300);
  }
  await expect(page.getByTestId("cluster-overview")).toHaveAttribute(
    "data-group",
    "all",
  );
  await expect(
    page.getByRole("button", { name: "Fit network to canvas" }),
  ).toHaveCount(0);
});
