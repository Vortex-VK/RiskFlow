import { expect, type Page } from "@playwright/test";
import type { Document } from "../src/domain/types";
import { readFile } from "node:fs/promises";
import { parseCsv } from "../src/domain/csv";

export async function fillModelInputs(page: Page) {
  if (
    !(await page
      .getByRole("combobox", { name: "Transaction channel", exact: true })
      .isVisible())
  )
    await page.getByText("Additional information", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Transaction channel", exact: true })
    .selectOption("Chip Transaction");
  await page.getByLabel("Merchant category code (four digits)").fill("5411");
  await page
    .getByRole("combobox", { name: "Completion status", exact: true })
    .selectOption("true");
}

export async function connectOnCanvas(
  page: Page,
  sourceId: string,
  targetId: string,
) {
  await page.locator(`.react-flow__node[data-id="${sourceId}"]`).focus();
  await page.keyboard.press("c");
  await page.locator(`.react-flow__node[data-id="${targetId}"]`).focus();
  await page.keyboard.press("Enter");
}

export async function syntheticModelCsv(path: string) {
  const table = parseCsv(await readFile(path, "utf8"));
  const fields = [...new Set([...table.headers, "channel", "mcc", "status"])];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return Buffer.from(
    [
      fields.map(escape).join(","),
      ...table.rows.map((row) => {
        const values = Object.fromEntries(
          table.headers.map((key, i) => [key, row.cells[i] || ""]),
        );
        values.channel = "Chip Transaction";
        values.mcc = "5411";
        values.status =
          values.status === "pending"
            ? "declined"
            : values.status || "completed";
        return fields.map((key) => escape(values[key] || "")).join(",");
      }),
    ].join("\n"),
  );
}

export async function setPlaybackSpeed(page: Page, speed: number) {
  const stops = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  expect(stops).toContain(speed);
  const slider = page.getByRole("slider", { name: "Playback speed" });
  await slider.press("Home");
  for (let index = 0; index < stops.indexOf(speed); index++)
    await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", `${speed}×`);
}

// A genuinely disconnected account supplies a leaf beside the shared-device
// community. Navigation tests must not depend on the old forced sector split.
export function addIndependentActivity(document: Document) {
  const payment = document.scenario.payments[0]!;
  const ids = new Map(
    [
      payment.accountId,
      payment.merchantId,
      payment.deviceId,
      payment.locationId,
    ].map((id) => [id, `isolated-${id}`]),
  );
  for (const [original, id] of ids) {
    const node = document.scenario.nodes.find((n) => n.id === original)!;
    document.scenario.nodes.push({
      ...node,
      id,
      name: `Independent ${node.type}`,
    });
    document.view.positions[id] = {
      x: 1000 + document.view.positions[original]!.x,
      y: 400,
    };
  }
  document.scenario.associations.push(
    ...document.scenario.associations
      .filter((a) => a.accountId === payment.accountId && ids.has(a.targetId))
      .map((a) => ({
        ...a,
        id: `isolated-${a.id}`,
        accountId: ids.get(a.accountId)!,
        targetId: ids.get(a.targetId)!,
      })),
  );
  document.scenario.payments.push({
    ...payment,
    id: "isolated-payment",
    accountId: ids.get(payment.accountId)!,
    merchantId: ids.get(payment.merchantId)!,
    deviceId: ids.get(payment.deviceId)!,
    locationId: ids.get(payment.locationId)!,
  });
}

export async function selectExample(page: Page) {
  await page.getByRole("button", { name: "About this workspace" }).click();
  await page.getByText("Scenario options", { exact: true }).click();
  await page.getByRole("button", { name: /^Shared Device Cluster/ }).click();
  await expect(page.locator(".about")).toHaveCount(0);
}

// Existing editor journeys exercise an explicit example in dark mode.
// Startup defaults are covered separately in workspace-start.spec.ts.
export async function openExampleWorkspace(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await selectExample(page);
}
