export const pagesHosting = import.meta.env.MODE === "pages";
const apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");
export const liveSimulationAvailable = !pagesHosting || Boolean(apiOrigin);
export const simulationOfflineMessage =
  "Live simulations are not connected yet. You can still build graphs, import CSVs, and explore samples.";

export function apiUrl(path: string): string {
  if (!liveSimulationAvailable) throw new Error(simulationOfflineMessage);
  return `${apiOrigin}${path}`;
}
