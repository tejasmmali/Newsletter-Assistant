import { describe, expect, it } from "vitest";
import { computeMetrics, countSyllables, METRIC_HELP } from "@/lib/metrics";

describe("computeMetrics", () => {
  it("returns zeros for empty text without NaN", () => {
    const metrics = computeMetrics("");
    expect(metrics).toEqual({
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      longestSentence: { text: "", words: 0 },
      readingTimeMin: 0,
      fleschReadingEase: 0,
    });
    for (const value of Object.values(metrics)) {
      if (typeof value === "number") expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("counts words and sentences with abbreviations and decimals", () => {
    const text =
      "Dr. Smith raised prices 2.5 percent in the U.S. today. Builders noticed.";
    const metrics = computeMetrics(text);
    expect(metrics.sentenceCount).toBe(2);
    expect(metrics.wordCount).toBeGreaterThan(8);
    expect(metrics.avgSentenceLength).toBeGreaterThan(0);
    expect(Number.isNaN(metrics.avgSentenceLength)).toBe(false);
    expect(metrics.longestSentence.words).toBeGreaterThanOrEqual(1);
    expect(text).toContain(metrics.longestSentence.text.slice(0, 10));
  });

  it("estimates reading time at 225 wpm", () => {
    const words = Array.from({ length: 225 }, (_, i) => `w${i}`).join(" ");
    const metrics = computeMetrics(`${words}.`);
    expect(metrics.wordCount).toBe(225);
    expect(metrics.readingTimeMin).toBe(1);
  });

  it("produces a finite Flesch score for normal prose", () => {
    const text = "Clear writing helps founders move faster when the claim is concrete.";
    const metrics = computeMetrics(text);
    expect(Number.isFinite(metrics.fleschReadingEase)).toBe(true);
    expect(countSyllables("writing")).toBeGreaterThan(1);
    expect(METRIC_HELP.fleschReadingEase).toMatch(/Rough signal only/);
  });
});
