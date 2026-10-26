import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:5185";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["pages.spec.ts"],
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
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --outDir dist-pages --host 127.0.0.1 --port 5185 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
