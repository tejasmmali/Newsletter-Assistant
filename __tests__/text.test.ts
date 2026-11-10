import { describe, expect, it } from "vitest";
import { findSkipRanges, splitSentences, splitWords } from "@/lib/text";

describe("splitSentences", () => {
  it("returns offsets that slice back to the original", () => {
    const text = "First idea landed. Second idea followed.";
    const sentences = splitSentences(text);
    expect(sentences).toHaveLength(2);
    for (const s of sentences) {
      expect(text.slice(s.start, s.end)).toBe(s.text);
      for (const w of s.words) {
        expect(text.slice(w.start, w.end)).toBe(w.text);
      }
    }
  });

  it("handles abbreviations without over-splitting", () => {
    const text = "Dr. Ng met partners in the U.S. before flying home.";
    expect(splitSentences(text)).toHaveLength(1);
  });

  it("handles decimals", () => {
    const text = "Accuracy rose to 92.5 percent after distillation.";
    expect(splitSentences(text)).toHaveLength(1);
  });
});

describe("splitWords", () => {
  it("preserves character offsets", () => {
    const text = "  Alpha beta";
    const words = splitWords(text);
    expect(words.map((w) => w.text)).toEqual(["Alpha", "beta"]);
    expect(text.slice(words[0]!.start, words[0]!.end)).toBe("Alpha");
  });
});

describe("findSkipRanges", () => {
  it("masks code, urls, and quotes", () => {
    const text = 'Use `code` and https://x.test/a and "quoted was made".';
    const ranges = findSkipRanges(text);
    expect(ranges.length).toBeGreaterThanOrEqual(3);
  });
});
