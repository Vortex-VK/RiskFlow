import { expect, it } from "vitest";
import { observedRanking } from "./rankingExplanation";

it("translates verified MCCs while preserving unknown codes and text categories", () => {
  expect(observedRanking("category", "5311")).toBe("Department store");
  expect(observedRanking("category", 5311)).toBe("Department store");
  expect(observedRanking("category", "9999")).toBe("Category code 9999");
  expect(observedRanking("category", "Travel")).toBe("Travel");
  expect(observedRanking("category", "__proto__")).toBe("__proto__");
  expect(observedRanking("category", null)).toBe("Not available");
  expect(observedRanking("category", "__MISSING__")).toBe("Not supplied");
});
