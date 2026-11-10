import { describe, expect, it } from "vitest";
import { paywallReason } from "@/lib/extract";

describe("paywallReason", () => {
  it("flags the VC Corner subscribe cutoff", () => {
    const text =
      "Anthropic filed its S-1 and disclosed revenue. ".repeat(12) +
      "Subscribe for free to continue reading";
    expect(paywallReason(text)).toMatch(/subscribe to continue/i);
  });

  it("flags embedded paywall phrases on short extracts", () => {
    const text = "The filing is long. Sign in to read the rest of this analysis about valuation.";
    expect(paywallReason(text.repeat(3))).toMatch(/sign in to read/i);
  });

  it("does not flag a long live blog", () => {
    const paragraph =
      "Live updates: the lab disclosed revenue, losses, and customer concentration in the S-1. ";
    const text = paragraph.repeat(120) + " Readers can continue reading the timeline below.";
    expect(text.length).toBeGreaterThan(8000);
    expect(paywallReason(text)).toBeNull();
  });
});
