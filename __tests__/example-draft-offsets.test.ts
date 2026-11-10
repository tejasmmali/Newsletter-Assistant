import { describe, expect, it } from "vitest";
import { analyzeDraft } from "@/lib/analyzer";
import { EXAMPLE_DRAFT } from "@/lib/example-draft";

describe("example draft offsets", () => {
  it("keeps text.slice(start, end) equal to original for every issue", () => {
    const issues = analyzeDraft(EXAMPLE_DRAFT);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(EXAMPLE_DRAFT.slice(issue.start, issue.end)).toBe(issue.original);
    }
  });
});
