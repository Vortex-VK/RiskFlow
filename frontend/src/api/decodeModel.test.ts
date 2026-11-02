import { describe, expect, it } from "vitest";
import { decodeModel } from "./decodeModel";

const legacy = {
  version: "ml-v13",
  policy: "depth6",
  bundleSha256: "a".repeat(64),
  alert: false,
  rawScores: { baseline: 0, cb: 0, online_cb: 0, online_ebm: 0, depth6: 0 },
  detectionPaths: [],
  historyCount: 0,
  feedbackAvailable: false,
};

describe("model evidence scope", () => {
  it("accepts the new policy but rejects mixed model identities and missing sequence margins", () => {
    const current = {
      ...legacy,
      version: "ml-upload-v5",
      policy: "recall85",
      alert: true,
      detectionPaths: ["sequence"],
      rawScores: { ...legacy.rawScores, base_margin: 1, sequence: 2 },
    };
    expect(decodeModel(current).version).toBe("ml-upload-v5");
    expect(() => decodeModel({ ...current, policy: "depth6" })).toThrow();
    expect(() =>
      decodeModel({ ...current, rawScores: legacy.rawScores }),
    ).toThrow();
    expect(() =>
      decodeModel({ ...current, detectionPaths: ["recent_model"] }),
    ).toThrow();
  });
  it("keeps historical results readable without inventing validation", () => {
    expect(decodeModel(legacy)).toMatchObject({
      evidenceScope: "synthetic_benchmark",
      uploadDomainValidated: false,
      probabilityAvailable: false,
    });
  });
  it("rejects unsupported domain and probability claims", () => {
    expect(() =>
      decodeModel({ ...legacy, uploadDomainValidated: true }),
    ).toThrow();
    expect(() =>
      decodeModel({ ...legacy, probabilityAvailable: true }),
    ).toThrow();
    expect(() =>
      decodeModel({ ...legacy, evidenceScope: "real_world" }),
    ).toThrow();
  });
});
