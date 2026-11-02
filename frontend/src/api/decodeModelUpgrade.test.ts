import { expect, it } from "vitest";
import legacy from "../../../fixtures/runtime/v13-compatibility-run.json";
import previous from "../../../fixtures/runtime/upload-v5-compatibility-run.json";
import coverage from "../../../fixtures/runtime/upload-v7-compatibility-run.json";
import current from "../../../fixtures/runtime/upload-v8-compatibility-run.json";
import adapted from "../../../fixtures/runtime/upload-v9-compatibility-run.json";
import template from "../../../fixtures/scenarios/stolen-card-burst.json";
import { decodeRun } from "./decodeRun";
import { decodeDocument } from "./decode";

for (const fixture of [legacy, previous, coverage, current, adapted]) {
  it(`decodes a captured ${fixture.engineVersion} run with its original model identity`, () => {
    const document = decodeDocument({
      scenario: fixture.scenarioSnapshot,
      view: template.view,
    });
    expect(decodeRun(fixture, document).events).toEqual(fixture.events);
    const mixed = structuredClone(fixture);
    mixed.events[0]!.model!.version =
      fixture.engineVersion === "engine-ml-v13" ? "ml-upload-v5" : "ml-v13";
    expect(() => decodeRun(mixed, document)).toThrow();
  });
}
