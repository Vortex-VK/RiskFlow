import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["public-demo.spec.ts"],
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5184",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // General editor journeys start after onboarding; tour tests open it explicitly.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5184",
          localStorage: [{ name: "riskflow:tutorial:v2", value: "seen" }],
        },
      ],
    },
  },
  webServer: [
    {
      command:
        '"..\\backend\\.venv\\Scripts\\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8123',
      url: "http://127.0.0.1:8123/api/v1/health",
      env: {
        RISKFLOW_DATA_DIR: mkdtempSync(join(tmpdir(), "riskflow-browser-")),
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5184",
      url: "http://127.0.0.1:5184",
      env: { RISKFLOW_API_URL: "http://127.0.0.1:8123" },
      reuseExistingServer: false,
    },
  ],
});
