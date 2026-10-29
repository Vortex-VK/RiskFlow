import { expect, test, type Page } from "@playwright/test";

async function enterDetail(page: Page) {
  for (let depth = 0; depth < 10; depth++) {
    await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
      "data-transitioning",
      "false",
    );
    const sectors = page.locator(".transaction-sector");
    if (!(await sectors.count())) return;
    await sectors.first().press("Enter");
  }
  throw new Error("Did not reach interactive detail");
}

const geometry = (page: Page) =>
  page
    .locator(".react-flow__node-object")
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [
          node.getAttribute("data-id"),
          (node as HTMLElement).style.transform,
        ]),
      ),
    );

async function dragObject(page: Page, touch: boolean) {
  const object = page.locator(".react-flow__node-object").first();
  const box = (await object.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + i * 5, y: y + i * 4 }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y + 40, { steps: 10 });
    await page.mouse.up();
  }
}

for (const mobile of [false, true]) {
  test.describe(mobile ? "phone" : "desktop", () => {
    test.use({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      hasTouch: mobile,
    });
    test("imported nodes stay moved at maximum zoom, including after leaving detail and in replay", async ({
      page,
    }) => {
      test.setTimeout(60000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "Samples", exact: true }).click();
      await page
        .getByRole("button", { name: /Shopping habits, interrupted/ })
        .click();
      await page
        .getByRole("button", { name: "Open in workspace", exact: true })
        .click();
      if (mobile) {
        await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
          "data-transitioning",
          "false",
        );
        // Pinching must enter a group, not just enlarge its non-interactive dots.
        await page.waitForTimeout(300);
        const sector = (await page
          .locator(".transaction-sector")
          .first()
          .boundingBox())!;
        const x = sector.x + sector.width / 2,
          y = sector.y + sector.height / 2;
        const session = await page.context().newCDPSession(page);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { id: 1, x: x - 12, y },
            { id: 2, x: x + 12, y },
          ],
        });
        for (let i = 1; i <= 15; i++) {
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              { id: 1, x: x - 12 - i * 5, y },
              { id: 2, x: x + 12 + i * 5, y },
            ],
          });
          await page.waitForTimeout(20);
        }
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await session.detach();
        await expect(page.getByTestId("cluster-overview")).not.toHaveAttribute(
          "data-group",
          "all",
        );
      }
      await enterDetail(page);
      const box = (await page
        .locator(".react-flow__node-object")
        .first()
        .boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -3000);
      const zoom = () =>
        page
          .locator(".react-flow__viewport")
          .evaluate(
            (node) => new DOMMatrix(getComputedStyle(node).transform).a,
          );
      await expect.poll(zoom).toBe(2);
      const before = await geometry(page);
      const paths = () =>
        page
          .locator(".react-flow__edge-path")
          .evaluateAll((edges) => edges.map((edge) => edge.getAttribute("d")));
      const edgesBefore = await paths();
      await dragObject(page, mobile);
      await expect.poll(() => geometry(page)).not.toEqual(before);
      const moved = await geometry(page);
      await expect.poll(paths).not.toEqual(edgesBefore);
      await page.waitForTimeout(350);
      expect(await geometry(page)).toEqual(moved);
      expect(await zoom()).toBe(2);
      await page.keyboard.press("Control+z");
      await expect.poll(() => geometry(page)).toEqual(before);
      await page.keyboard.press("Control+Shift+z");
      await expect.poll(() => geometry(page)).toEqual(moved);
      await page
        .getByRole("button", { name: "All payments", exact: true })
        .click();
      await enterDetail(page);
      expect(await geometry(page)).toEqual(moved);

      await page.getByRole("button", { name: "Simulate", exact: true }).click();
      await page
        .getByRole("button", { name: "Inspect payments", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close events", exact: true })
        .click();
      await expect(page.locator(".hierarchy-stage")).toHaveAttribute(
        "data-transitioning",
        "false",
      );
      await page
        .getByRole("button", { name: "All payments", exact: true })
        .click();
      await enterDetail(page);
      const replayBefore = await geometry(page);
      await dragObject(page, mobile);
      await expect.poll(() => geometry(page)).not.toEqual(replayBefore);
      const replayMoved = await geometry(page);
      await page
        .getByRole("button", { name: "All payments", exact: true })
        .click();
      await enterDetail(page);
      expect(await geometry(page)).toEqual(replayMoved);
      await page
        .getByRole("button", { name: "Edit scenario", exact: true })
        .click();
      await expect.poll(() => geometry(page)).toEqual(moved);
      expect(errors).toEqual([]);
    });
  });
}
