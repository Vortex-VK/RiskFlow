import { expect, it } from "vitest";
import { rankingFact } from "./rankingExplanation";

it("describes account history, method use and timing in ordinary quantities", () => {
  expect(rankingFact("p_channel_frequency", 0.3, 10)).toEqual({
    value: "30.0%",
    context: "of earlier payments used this payment method",
  });
  expect(rankingFact("p_channel_frequency", 0, 0).value).toBe(
    "No earlier payments",
  );
  expect(rankingFact("p_log_gap_ratio", Math.log(1.1)).value).toBe(
    "10% longer",
  );
  expect(rankingFact("p_log_gap_ratio", Math.log(0.3)).value).toBe(
    "70% shorter",
  );
  expect(rankingFact("p_log_gap_ratio", 0).value).toBe("About the usual wait");
  expect(rankingFact("p_log_gap_ratio", null).value).toBe("Too little history");
  expect(rankingFact("p_log_history_n", Math.log1p(22))).toEqual({
    value: "22 earlier payments",
    context: "from this account",
  });
});
