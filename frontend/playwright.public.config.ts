import { defineConfig } from "@playwright/test";

const baseURL = process.env.RISKFLOW_TEST_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["public-demo.spec.ts"],
  timeout: 90000,
  workers: 1,
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [{ name: "riskflow:tutorial:v2", value: "seen" }],
        },
      ],
    },
  },
});
