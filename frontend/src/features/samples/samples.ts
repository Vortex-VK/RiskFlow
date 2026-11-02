import { unsupportedRankingInput } from "../../domain/model";
import catalog from "./catalog.json";
import { buildCsvDocument, initialMapping, parseCsv } from "../../domain/csv";
import { csvDefaults } from "../../domain/csv-defaults";
import { decodeCsvBytes } from "../../domain/csv-values";
import { MAX_CSV_BYTES } from "../../domain/limits";

export { catalog };
export type Sample = (typeof catalog.samples)[number];
type SampleSource = Pick<
  Sample,
  "title" | "rows" | "file" | "bytes" | "sha256"
>;

export function sampleUrl(file: string) {
  return `${import.meta.env.BASE_URL}samples/${file}`;
}

export function sampleDocument(
  sample: Pick<Sample, "title" | "rows">,
  content: string,
) {
  const table = parseCsv(content);
  if (table.rows.length !== sample.rows)
    throw new Error("This sample is incomplete. Please reload and try again.");
  const result = buildCsvDocument(
    table,
    initialMapping(table.headers),
    csvDefaults(sample.title),
  );
  if (!result.document || result.errors.length)
    throw new Error(
      result.errors.join(" ") || "Unable to prepare this sample.",
    );
  if (
    result.document.scenario.payments.length !== sample.rows ||
    result.document.scenario.payments.some(unsupportedRankingInput)
  )
    throw new Error("This sample is missing required model inputs.");
  return result.document;
}

export async function loadSample(
  sample: SampleSource,
  signal: AbortSignal,
  url = sampleUrl(sample.file),
) {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error("The sample could not be downloaded. Please try again.");
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  if (bytes.byteLength !== sample.bytes || bytes.byteLength > MAX_CSV_BYTES)
    throw new Error(
      "This sample has an unexpected size. Please reload and try again.",
    );
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  signal.throwIfAborted();
  if (hash !== sample.sha256)
    throw new Error(
      "This sample has changed. Please reload to get the current version.",
    );
  return sampleDocument(sample, decodeCsvBytes(bytes));
}
