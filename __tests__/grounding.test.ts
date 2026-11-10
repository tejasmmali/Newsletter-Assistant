import { describe, expect, it } from "vitest";
import {
  groundClaim,
  normalizeQuoteText,
  quoteExistsInSource,
  similarityRatio,
} from "@/lib/grounding";
import type { BriefClaim, Source } from "@/lib/schemas";

const source: Source = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "https://example.com/ai",
  title: "Example",
  text: 'OpenAI launched a new model today. The company said "latency dropped by 40%" in production.',
  note: null,
  status: "ok",
  error: null,
  created_at: new Date().toISOString(),
};

function claim(partial: Partial<BriefClaim> & Pick<BriefClaim, "text" | "supporting_quote" | "type">): BriefClaim {
  return {
    source_id: source.id,
    ...partial,
  };
}

describe("normalizeQuoteText", () => {
  it("normalizes smart quotes and whitespace", () => {
    expect(normalizeQuoteText("  “latency   dropped”  ")).toBe('"latency dropped"');
    expect(normalizeQuoteText("it’s")).toBe("it's");
  });
});

describe("quoteExistsInSource", () => {
  it("matches exact quotes after normalization", () => {
    expect(quoteExistsInSource("latency dropped by 40%", source.text ?? "")).toBe(true);
    expect(quoteExistsInSource("“latency dropped by 40%”", source.text ?? "")).toBe(true);
  });

  it("matches fuzzy quotes at or above 0.9", () => {
    const ok = quoteExistsInSource(
      "latency dropped by 40% in production",
      source.text ?? ""
    );
    expect(ok).toBe(true);
    expect(similarityRatio("latency dropped by 40%", "latency droped by 40%")).toBeGreaterThan(0.9);
  });
});

describe("groundClaim", () => {
  it("verifies a fact whose quote is in the source", () => {
    const result = groundClaim(
      claim({
        text: "Latency fell.",
        type: "fact",
        supporting_quote: "latency dropped by 40%",
      }),
      [source]
    );
    expect(result.verified).toBe(true);
  });

  it("downgrades a fact with a missing quote", () => {
    const result = groundClaim(
      claim({
        text: "Margins doubled.",
        type: "fact",
        supporting_quote: "margins doubled overnight",
      }),
      [source]
    );
    expect(result.verified).toBe(false);
    expect(result.downgrade_note).toMatch(/unverified/i);
  });
});
