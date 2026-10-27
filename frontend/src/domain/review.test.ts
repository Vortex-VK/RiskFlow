import { describe, expect, it } from "vitest";
import {
  needsReview,
  reviewIds,
  summarizeReview,
  reviewContext,
} from "./review";

it("describes affected entities and history without needing outcome labels", () => {
  const events = [
    {
      decision: "review",
      accountId: "a",
      merchantId: "m",
      model: {
        alert: true,
        historyCount: 0,
        score: { value: 95, probabilityAvailable: true },
      },
    },
    {
      decision: "review",
      accountId: "a",
      merchantId: "n",
      model: {
        alert: true,
        historyCount: 9,
        score: { value: 90, probabilityAvailable: true },
      },
    },
    {
      decision: "approve",
      accountId: "b",
      merchantId: "m",
      model: {
        alert: false,
        historyCount: 10,
        score: { value: 10, probabilityAvailable: true },
      },
    },
  ];
  expect(reviewContext(events)).toEqual({
    accounts: 2,
    merchants: 2,
    reviewAccounts: 1,
    reviewMerchants: 2,
    historyAssessed: 3,
    noHistory: 1,
    shortHistory: 2,
  });
  expect(reviewContext(events, 100)).toMatchObject({
    reviewAccounts: 0,
    reviewMerchants: 0,
    noHistory: 1,
  });
});

describe("recorded review decisions", () => {
  it("uses model alerts instead of legacy decisions or display probabilities", () => {
    expect(needsReview({ decision: "approve", model: { alert: true } })).toBe(
      true,
    );
    expect(needsReview({ decision: "review", model: { alert: false } })).toBe(
      false,
    );
    expect(needsReview({ decision: "block", model: { alert: false } })).toBe(
      false,
    );
  });
  it("supports historical rule runs and counts payments, not shared graph paths", () => {
    expect([
      ...reviewIds([
        { eventId: "a", decision: "review" },
        { eventId: "b", decision: "block", model: null },
        { eventId: "c", decision: "approve" },
        { eventId: "d", decision: "approve", model: { alert: true } },
      ]),
    ]).toEqual(["a", "b", "d"]);
  });
});

describe("probability threshold preview", () => {
  const events = [
    {
      eventId: "a",
      decision: "approve",
      amountMinor: 100,
      model: { alert: false, score: { value: 50, probabilityAvailable: true } },
    },
    {
      eventId: "b",
      decision: "review",
      amountMinor: 200,
      model: {
        alert: true,
        score: { value: 49.999, probabilityAvailable: true },
      },
    },
    {
      eventId: "c",
      decision: "approve",
      amountMinor: 300,
      model: {
        alert: false,
        score: { value: 100, probabilityAvailable: true },
      },
    },
    {
      eventId: "d",
      decision: "review",
      amountMinor: 400,
      model: { alert: true, score: { value: 99, probabilityAvailable: false } },
    },
  ];
  it("uses an inclusive exact boundary without changing recorded decisions or historical scores", () => {
    expect([...reviewIds(events, 50)]).toEqual(["a", "c", "d"]);
    expect([...reviewIds(events, 0)]).toHaveLength(4);
    expect([...reviewIds(events, 100)]).toEqual(["c", "d"]);
    expect([...reviewIds(events)]).toEqual(["b", "d"]);
  });
  it("calculates workload and labeled outcomes independently, excluding unlabeled rows from accuracy", () => {
    const result = summarizeReview(
      events,
      { a: "fraudulent", b: "fraudulent", c: "legitimate" },
      50,
    );
    expect(result).toMatchObject({
      reviews: 3,
      reviewAmount: 800,
      totalAmount: 1000,
      tp: 1,
      fn: 1,
      fp: 1,
      tn: 0,
      labeled: 3,
      precision: 0.5,
      recall: 0.5,
      bins: [0, 0, 2, 0, 1],
    });
    expect(summarizeReview(events, {}, 50)).toMatchObject({
      labeled: 0,
      precision: null,
      recall: null,
    });
    expect(summarizeReview([], {})).toMatchObject({
      reviews: 0,
      totalAmount: 0,
      labeled: 0,
      precision: null,
      recall: null,
    });
  });
});
