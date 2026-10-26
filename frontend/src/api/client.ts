import { decodeDocument, decodeTemplates } from "./decode";
import { requireModelService } from "./modelService";
import { apiUrl, pagesHosting } from "./endpoint";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(
    pagesHosting ? `/presets${path}.json` : apiUrl(`/api/v1${path}`),
    {
      ...init,
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(
      `The service could not complete this request (${response.status}). Try again.`,
    );
  if (!response.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("The service returned an unexpected response format.");
  return response.json() as Promise<unknown>;
}

export async function getTemplates() {
  const data = await request("/templates");
  return decodeTemplates(data);
}

export async function getTemplate(id: string) {
  if (!pagesHosting) await requireModelService();
  return decodeDocument(await request(`/templates/${encodeURIComponent(id)}`));
}
