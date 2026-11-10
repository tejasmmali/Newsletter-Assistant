import { describe, expect, it } from "vitest";
import { validateRewrite } from "@/lib/rewrite-guard";

describe("validateRewrite", () => {
  it("accepts a minimal safe rewrite", () => {
    const original =
      "OpenAI may cut inference prices by 40% for Claude-adjacent workloads.";
    const rewritten =
      "OpenAI may reduce inference prices by 40% for Claude-adjacent workloads.";
    expect(validateRewrite(original, rewritten)).toEqual({ ok: true });
  });

  it("rejects when a number/percentage is dropped", () => {
    const original = "Pricing fell 40% after the March launch.";
    const rewritten = "Pricing fell after the March launch.";
    const result = validateRewrite(original, rewritten);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_number");
  });

  it("rejects when a capitalized name is dropped", () => {
    const original = "Anthropic shipped a quieter update for Claude users.";
    const rewritten = "The lab shipped a quieter update for users.";
    const result = validateRewrite(original, rewritten);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_name");
  });

  it("rejects when hedging is dropped", () => {
    const original = "The system may improve reliability for operators.";
    const rewritten = "The system improves reliability for operators.";
    const result = validateRewrite(original, rewritten);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_hedge");
  });
});
