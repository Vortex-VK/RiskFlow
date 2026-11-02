import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { components } from "../api/generated";
import { ScoreValue } from "./ContinuousScores";

it("highlights the exact 90% boundary without upgrading a rounded estimate or a historical index", () => {
  const score: components["schemas"]["EvidenceScore"] = {
    version: "fraud-probability-v1",
    source: "coverage",
    value: 90,
    rawMargin: 3,
    referenceThreshold: 2,
    referenceValue: 80,
    distance: 1,
    probabilityAvailable: true,
  };
  const render = (value: typeof score) =>
    renderToStaticMarkup(
      createElement(ScoreValue, { score: value, label: "V8 card" }),
    );
  expect(render(score)).toContain("High estimated risk");
  expect(render({ ...score, value: 89.999 })).not.toContain(
    "High estimated risk",
  );
  expect(
    render({
      ...score,
      value: 99,
      version: "margin-index-v1",
      probabilityAvailable: false,
    }),
  ).not.toContain("High estimated risk");
});
