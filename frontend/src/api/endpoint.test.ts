import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("keeps the local app on the same-origin API", async () => {
  vi.stubEnv("MODE", "development");
  vi.stubEnv("VITE_API_ORIGIN", "");
  const api = await import("./endpoint");
  expect(api.liveSimulationAvailable).toBe(true);
  expect(api.apiUrl("/api/v1/health")).toBe("/api/v1/health");
});

it("does not send simulations to the static host when disconnected", async () => {
  vi.stubEnv("MODE", "pages");
  vi.stubEnv("VITE_API_ORIGIN", "");
  const api = await import("./endpoint");
  expect(api.liveSimulationAvailable).toBe(false);
  expect(() => api.apiUrl("/api/v1/simulations")).toThrow("not connected yet");
});

it("routes live simulations to the configured HTTPS backend", async () => {
  vi.stubEnv("MODE", "pages");
  vi.stubEnv("VITE_API_ORIGIN", "https://api.example.com/");
  const api = await import("./endpoint");
  expect(api.liveSimulationAvailable).toBe(true);
  expect(api.apiUrl("/api/v1/simulations")).toBe(
    "https://api.example.com/api/v1/simulations",
  );
});
