import { describe, expect, it } from "vitest";
import { analyzeDraft, type Issue } from "@/lib/analyzer";

function byType(issues: Issue[], type: Issue["type"]): Issue[] {
  return issues.filter((issue) => issue.type === type);
}

function assertOffsets(text: string, issues: Issue[]) {
  for (const issue of issues) {
    expect(issue.end).toBeGreaterThan(issue.start);
    expect(text.slice(issue.start, issue.end)).toBe(issue.original);
  }
}

describe("analyzeDraft", () => {
  it("returns no issues for empty input", () => {
    expect(analyzeDraft("")).toEqual([]);
    expect(analyzeDraft("   \n\t")).toEqual([]);
  });

  describe("long_sentence", () => {
    it("flags medium at >30 words and high at >40", () => {
      const medium = Array.from({ length: 32 }, (_, i) => `w${i}`).join(" ") + ".";
      const high = Array.from({ length: 42 }, (_, i) => `w${i}`).join(" ") + ".";
      const medIssues = byType(analyzeDraft(medium), "long_sentence");
      const highIssues = byType(analyzeDraft(high), "long_sentence");
      expect(medIssues).toHaveLength(1);
      expect(medIssues[0]?.severity).toBe("medium");
      expect(highIssues[0]?.severity).toBe("high");
      expect(highIssues[0]?.suggestion).toBeUndefined();
      assertOffsets(medium, medIssues);
      assertOffsets(high, highIssues);
    });

    it("does not flag short sentences", () => {
      const text = "Short and clear writing wins readers.";
      expect(byType(analyzeDraft(text), "long_sentence")).toHaveLength(0);
    });
  });

  it("suggests a replacement only for the in-order-to filler", () => {
    const text = "We built this in order to ship. It is important to note that costs rose.";
    const fillers = byType(analyzeDraft(text), "filler");
    const suggested = fillers.filter((issue) => issue.suggestion);
    expect(suggested).toHaveLength(1);
    expect(suggested[0]?.suggestion).toBe("to");
    assertOffsets(text, fillers);
  });
});
