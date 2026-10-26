export async function requireModelService(signal?: AbortSignal): Promise<void> {
  const response = await fetch("/api/v1/health", {
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("The simulation service is unavailable. Please try again.");
  if (!response.headers.get("content-type")?.startsWith("application/json"))
    throw new Error(
      "The API connection returned an unexpected response. Check that the RiskFlow backend is running.",
    );
  const health: unknown = await response.json();
  if (
    !health ||
    typeof health !== "object" ||
    !("engineVersion" in health) ||
    health.engineVersion !== "engine-ml-upload-v9" ||
    !("schemaVersion" in health) ||
    health.schemaVersion !== 1 ||
    !("status" in health) ||
    health.status !== "ok"
  )
    throw new Error(
      "The running backend is incompatible with this app. Restart the RiskFlow backend, then retry. Your draft is unchanged.",
    );
}
