import { afterEach, expect, it, vi } from "vitest";
import retained from "../../../fixtures/runtime/card-pattern-assessment-v9.json";
import { decodeAssessment } from "./decodeAssessment";
import {
  discardPreparation,
  prepareSimulation,
  takePreparedSimulation,
} from "./prepareSimulation";

const fixture = decodeAssessment(retained);
const health = {
  status: "ok",
  schemaVersion: 1,
  engineVersion: "engine-ml-upload-v9",
};
afterEach(() => {
  discardPreparation();
  vi.unstubAllGlobals();
});

it("shares in-flight preparation and consumes the validated result without another request", async () => {
  let release!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(health))
    .mockReturnValueOnce(response);
  vi.stubGlobal("fetch", fetcher);
  const first = prepareSimulation(fixture.document);
  expect(prepareSimulation(structuredClone(fixture.document))).toBe(first);
  const clicked = takePreparedSimulation(fixture.document);
  release(Response.json(fixture.simulation));
  expect((await clicked)?.runId).toBe(fixture.simulation?.runId);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("reuses completed preparation after a layout change but invalidates changed input", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(health))
    .mockResolvedValueOnce(Response.json(fixture.simulation));
  vi.stubGlobal("fetch", fetcher);
  const first = prepareSimulation(fixture.document);
  await first;
  const moved = structuredClone(fixture.document);
  moved.view.viewport.x += 100;
  discardPreparation(moved);
  expect(prepareSimulation(moved)).toBe(first);
  const changed = structuredClone(moved);
  changed.scenario.payments[0]!.amountMinor++;
  discardPreparation(changed);
  expect((fetcher.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true);
});

it("failed background work is retryable and invalid input does not start work", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(Response.json(health))
    .mockResolvedValueOnce(Response.json(fixture.simulation));
  vi.stubGlobal("fetch", fetcher);
  await expect(prepareSimulation(fixture.document)).rejects.toThrow("Offline");
  expect((await takePreparedSimulation(fixture.document))?.runId).toBe(
    fixture.simulation?.runId,
  );
  const incomplete = structuredClone(fixture.document);
  incomplete.scenario.payments[0]!.modelInput = null;
  expect(prepareSimulation(incomplete)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
});
