import { afterEach, expect, it, vi } from "vitest";
import {
  decodeStackExplanation,
  fetchStackExplanation,
} from "./stackExplanation";
import type { Scenario } from "../domain/types";
import { rankingWalkthrough } from "../domain/rankingExplanation";
import explanation from "../../../fixtures/runtime/stack-d5/explanation.json";
import run from "../../../fixtures/runtime/stack-d5/run.json";
import type { EventResult } from "../domain/runs";

const event = run.events.find(
  (e) => e.eventId === explanation.eventId,
)! as EventResult;

afterEach(() => vi.unstubAllGlobals());

it("distinguishes an outdated backend from a changed snapshot", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: { message: "This saved result uses a different model version." },
      }),
      { status: 409 },
    ),
  );
  await expect(
    fetchStackExplanation(
      run.scenarioSnapshot as Scenario,
      event,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Restart RiskFlow");
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: { message: "This snapshot does not reproduce the saved score." },
      }),
      { status: 409 },
    ),
  );
  await expect(
    fetchStackExplanation(
      run.scenarioSnapshot as Scenario,
      event,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Run Simulate again");
});

it("checks all head contributions against the recorded prediction", () => {
  expect(
    decodeStackExplanation(explanation, event).facts.length,
  ).toBeGreaterThan(2);
  for (const changed of [
    { ...explanation, rawMargin: explanation.rawMargin + 1 },
    { ...explanation, baseValue: explanation.baseValue + 1 },
    { ...explanation, contributions: explanation.contributions.slice(1) },
    { ...explanation, probability: 90 },
  ])
    expect(() => decodeStackExplanation(changed, event)).toThrow();
});

it("maps the additive explanation into queue positions and preserves the final rank", () => {
  const data = decodeStackExplanation(explanation, event);
  const rankAt = (score: number) =>
    1 +
    run.events.filter(
      (e) => e.eventId !== event.eventId && e.model.ranking.rawMargin > score,
    ).length;
  const result = rankingWalkthrough(data, rankAt);
  expect(result.final).toBe(rankAt(event.model!.ranking!.rawMargin));
  expect(result.steps.reduce((n, s) => n + s.movement, 0)).toBe(
    result.start - result.final,
  );
  expect(result.steps.at(-1)!.to).toBe(result.final);
});
