import { describe, expect, it } from "vitest";
import { analyzeDraft } from "@/lib/analyzer";
import { computeMetrics } from "@/lib/metrics";
import { splitSentences } from "@/lib/text";

describe("phase-5 regression cases", () => {
  it("does not treat ellipsis as multiple sentence breaks", () => {
    const text = "Shipping slowed… then recovered for builders.";
    expect(splitSentences(text).length).toBe(1);
  });

  it("keeps filler detection off inside fenced code blocks", () => {
    const text = ["Intro line.", "```", "in order to hack", "```", "Outro."].join(
      "\n"
    );
    const fillers = analyzeDraft(text).filter((i) => i.type === "filler");
    expect(fillers).toHaveLength(0);
  });

  it("metrics stay finite for a single-word draft", () => {
    const m = computeMetrics("Hello");
    expect(Number.isFinite(m.fleschReadingEase)).toBe(true);
    expect(Number.isNaN(m.avgSentenceLength)).toBe(false);
    expect(m.wordCount).toBe(1);
  });
});
