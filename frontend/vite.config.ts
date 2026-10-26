import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (env.VITE_API_ORIGIN) {
    const url = new URL(env.VITE_API_ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error(
        "VITE_API_ORIGIN must be a public HTTPS origin without a path or credentials.",
      );
    }
  }
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": process.env.RISKFLOW_API_URL || "http://127.0.0.1:8000",
      },
    },
    test: { include: ["src/**/*.test.ts"] },
  };
});
