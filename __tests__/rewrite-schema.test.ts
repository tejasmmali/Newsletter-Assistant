import { describe, expect, it } from "vitest";
import {
  RewriteLlmResponseSchema,
  RewriteRequestSchema,
  RewriteResponseSchema,
} from "@/lib/schemas";

describe("rewrite schemas", () => {
  it("accepts a valid rewrite request", () => {
    const parsed = RewriteRequestSchema.parse({
      draft: "We built this in order to ship.",
      issues: [
        {
          id: "filler:10-21",
          type: "filler",
          severity: "low",
          start: 14,
          end: 25,
          original: "in order to",
          explanation: "wordy",
          suggestion: "to",
        },
      ],
    });
    expect(parsed.issues).toHaveLength(1);
  });

  it("rejects more than 15 issues", () => {
    const issues = Array.from({ length: 16 }, (_, i) => ({
      id: `filler:${i}`,
      type: "filler" as const,
      severity: "low" as const,
      start: i,
      end: i + 1,
      original: "x",
      explanation: "wordy",
    }));
    expect(() =>
      RewriteRequestSchema.parse({ draft: "abcdefghijklmnop", issues })
    ).toThrow();
  });

  it("validates LLM and API response shapes", () => {
    const llm = RewriteLlmResponseSchema.parse({
      rewrites: [
        {
          issue_id: "filler:1-2",
          rewritten: "to",
          rationale: "Tighten filler.",
        },
      ],
    });
    expect(llm.rewrites[0]?.rationale).toBeTruthy();

    const api = RewriteResponseSchema.parse({
      rewrites: [
        {
          issue_id: "filler:1-2",
          rewritten: "to",
          guard_rejected: true,
        },
      ],
    });
    expect(api.rewrites[0]?.rewritten).toBe("to");
  });
});
