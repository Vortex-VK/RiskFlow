import { afterEach, expect, it, vi } from "vitest";
import { requireModelService } from "./modelService";

afterEach(() => vi.unstubAllGlobals());

it.each(["engine-v1", "engine-v3", "engine-ml-v13", "unknown"])(
  "rejects the incompatible backend %s with restart guidance",
  async (engineVersion) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ status: "ok", schemaVersion: 1, engineVersion }),
        ),
    );
    await expect(requireModelService()).rejects.toThrow(
      "Restart the RiskFlow backend",
    );
  },
);

it("requires a healthy model service and uses an uncached readiness request", async () => {
  const request = vi.fn().mockResolvedValue(
    Response.json({
      status: "ok",
      schemaVersion: 1,
      engineVersion: "engine-ml-upload-v9",
    }),
  );
  vi.stubGlobal("fetch", request);
  await requireModelService();
  expect(request).toHaveBeenCalledWith(
    "/api/v1/health",
    expect.objectContaining({ cache: "no-store" }),
  );
  request.mockResolvedValue(Response.json({}, { status: 503 }));
  await expect(requireModelService()).rejects.toThrow(
    "simulation service is unavailable",
  );
  request.mockResolvedValue(new Response("<html>"));
  await expect(requireModelService()).rejects.toThrow("unexpected response");
});
