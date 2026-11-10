import { describe, expect, it } from "vitest";
import { validateRewrite } from "@/lib/rewrite-guard";

/**
 * Adversarial cases for rewrite-guard.
 * Document which failures the guard catches for the editorial README.
 */
export const ADVERSARIAL_CASES = [
  {
    name: "drops percentage",
    original: "Revenue rose 37% after launch.",
    rewritten: "Revenue rose after launch.",
    expectReason: "missing_number",
  },
  {
    name: "drops dollar amount",
    original: "Customers pay $10,000 a month for seats.",
    rewritten: "Customers pay a lot a month for seats.",
    expectReason: "missing_number",
  },
  {
    name: "drops date",
    original: "The preview landed on March 12, 2026.",
    rewritten: "The preview landed recently.",
    expectReason: "missing_number",
  },
  {
    name: "drops product name",
    original: "Claude remains popular with operators.",
    rewritten: "The chatbot remains popular with operators.",
    expectReason: "missing_name",
  },
  {
    name: "drops reportedly hedge",
    original: "The lab reportedly delayed the release.",
    rewritten: "The lab delayed the release.",
    expectReason: "missing_hedge",
  },
  {
    name: "safe minimal edit",
    original: "OpenAI may cut prices by 40% for Claude users.",
    rewritten: "OpenAI may reduce prices by 40% for Claude users.",
    expectReason: null,
  },
] as const;

describe("rewrite-guard adversarial set", () => {
  for (const testCase of ADVERSARIAL_CASES) {
    it(testCase.name, () => {
      const result = validateRewrite(testCase.original, testCase.rewritten);
      if (testCase.expectReason === null) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reasons).toContain(testCase.expectReason);
      }
    });
  }
});
