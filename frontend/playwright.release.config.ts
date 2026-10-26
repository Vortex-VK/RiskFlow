import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:8123",
    browserName:
      process.env.RISKFLOW_BROWSER === "firefox" ? "firefox" : "chromium",
    channel: process.env.RISKFLOW_BROWSER === "firefox" ? undefined : "chrome",
  },
  webServer: {
    command:
      '"..\\backend\\.venv\\Scripts\\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8123',
    url: "http://127.0.0.1:8123/api/v1/health",
    env: {
      RISKFLOW_FRONTEND_DIR: "../frontend/dist",
      RISKFLOW_DATA_DIR: mkdtempSync(join(tmpdir(), "riskflow-release-")),
    },
    reuseExistingServer: false,
  },
});
