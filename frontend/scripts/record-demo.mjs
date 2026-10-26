import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const destination = path.join(root, "docs", "demo");
await mkdir(destination, { recursive: true });
const python = path.join(
  root,
  "backend",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const server = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8125",
    "--log-level",
    "warning",
  ],
  {
    cwd: root,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      RISKFLOW_FRONTEND_DIR: path.join(root, "frontend", "dist"),
    },
  },
);
let browser;
try {
  const deadline = Date.now() + 15000;
  while (true) {
    if (server.exitCode !== null)
      throw new Error("Demo server exited before readiness.");
    try {
      if ((await fetch("http://127.0.0.1:8125/api/v1/health")).ok) break;
    } catch {}
    if (Date.now() > deadline)
      throw new Error("Demo server did not become ready.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: { dir: destination, size: { width: 1366, height: 768 } },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8125");
  await page.getByRole("button", { name: "Simulate", exact: true }).waitFor();
  const start = Date.now();
  const at = async (seconds) => {
    const remaining = start + seconds * 1000 - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
  };
  const caption = (text) =>
    page.evaluate((text) => {
      let element = document.getElementById("demo-caption");
      if (!element) {
        element = document.createElement("div");
        element.id = "demo-caption";
        Object.assign(element.style, {
          position: "fixed",
          bottom: "94px",
          left: "28px",
          maxWidth: "410px",
          background: "#ffffff",
          color: "#253b3c",
          border: "1px solid #ccd8d0",
          borderRadius: "12px",
          padding: "14px 18px",
          font: "15px/1.5 Segoe UI, sans-serif",
          zIndex: "100",
          pointerEvents: "none",
        });
        document.body.append(element);
      }
      element.textContent = text;
    }, text);
  await caption(
    "RiskFlow: explore how payment context changes a rule-based risk score. This is a synthetic simulation, not a fraud probability.",
  );
  await at(5);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await caption(
    "Build with jelly objects, or import a transaction CSV. Everything lasts for this session.",
  );
  await at(10);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("2");
  await caption(
    "Three accounts share one device. The Python engine evaluates each payment using only the history available at that time.",
  );
  await at(24);
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("button", { name: "Inspect H10", exact: true }).click();
  const explanation = page.getByRole("complementary", {
    name: "Payment explanation",
  });
  if (!(await explanation.textContent()).includes("85/100"))
    throw new Error("Unexpected hero score.");
  await caption(
    "H10 scores 85: amount, a new device, category, and 25 points from cross-account device sharing.",
  );
  const shared = explanation
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: "shared device accounts" }),
    })
    .first();
  await shared.getByText("Measurements & evidence", { exact: true }).click();
  await shared.getByRole("button", { name: "Highlight evidence" }).click();
  await at(38);
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await page.getByRole("button", { name: "Payments 16" }).click();
  await page.getByRole("button", { name: "Payment H09", exact: true }).click();
  await caption(
    "Change H09 to Casey's familiar phone. Its synthetic label stays the same; the device-use history changes.",
  );
  await at(44);
  await page
    .getByRole("combobox", { name: "Device", exact: true })
    .selectOption("device-c");
  await at(48);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await at(52);
  await page.getByRole("button", { name: "Compare runs" }).click();
  await caption(
    "Five decisions change from Block to Review. H10's payment record is untouched: its earlier shared-device history changed.",
  );
  await page.getByRole("button", { name: "Compare H10", exact: true }).click();
  if (
    !(
      await page.getByRole("region", { name: "Payment changes" }).textContent()
    ).includes("60")
  )
    throw new Error("Unexpected comparison score.");
  await at(64);
  await caption(
    "Illustrative labeled cost rises from $6 to $21 as reviews increase from 2 to 7. These are transparent assumptions, not a validated business forecast.",
  );
  await at(76);
  const video = page.video();
  await context.close();
  const recording = await video.path();
  await copyFile(recording, path.join(destination, "riskflow-demo.webm"));
  await unlink(recording);
  console.log(
    "Recorded docs/demo/riskflow-demo.webm (approximately 76 seconds).",
  );
} finally {
  await browser?.close();
  server.kill();
}
