import type { Brief, BriefClaim, GroundedBrief, GroundedClaim, Source } from "@/lib/schemas";

const FUZZY_THRESHOLD = 0.9;

/** Normalize whitespace and smart quotes for deterministic matching. */
export function normalizeQuoteText(input: string): string {
  return input
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const aChar = a.charAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = aChar === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? 0;
  }

  return prev[b.length] ?? 0;
}

export function similarityRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Exact match after normalization, then fuzzy sliding-window match at >= 0.9.
 */
export function quoteExistsInSource(quote: string, sourceText: string): boolean {
  const needle = normalizeQuoteText(quote).replace(/["']/g, "");
  const haystack = normalizeQuoteText(sourceText).replace(/["']/g, "");
  if (!needle || !haystack) return false;
  if (haystack.includes(needle)) return true;
  if (needle.length < 20 || needle.length > haystack.length) return false;

  const step = Math.max(1, Math.floor(needle.length / 8));
  for (let i = 0; i + needle.length <= haystack.length; i += step) {
    const window = haystack.slice(i, i + needle.length);
    if (similarityRatio(needle, window) >= FUZZY_THRESHOLD) return true;
  }
  return false;
}

export function groundClaim(claim: BriefClaim, sources: Source[]): GroundedClaim {
  const source = sources.find((item) => item.id === claim.source_id);
  const sourceText = source?.text ?? "";
  const quoteOk =
    claim.supporting_quote.trim().length > 0 &&
    quoteExistsInSource(claim.supporting_quote, sourceText);

  if (claim.type === "fact" && quoteOk) {
    return { ...claim, verified: true };
  }
  if (claim.type === "fact") {
    return {
      ...claim,
      verified: false,
      downgrade_note: "fact downgraded to unverified",
    };
  }
  return { ...claim, verified: false };
}

export function groundBrief(brief: Brief, sources: Source[]): GroundedBrief {
  return {
    ...brief,
    claims: brief.claims.map((claim) => groundClaim(claim, sources)),
  };
}
