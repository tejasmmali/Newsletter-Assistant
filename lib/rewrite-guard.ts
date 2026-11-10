import { AI_JARGON } from "@/lib/analyzer";

const HEDGES = [
  "may",
  "might",
  "could",
  "reportedly",
  "likely",
  "appears",
  "seem",
  "seems",
  "apparently",
  "possibly",
  "perhaps",
] as const;

export type GuardFailureReason =
  | "empty"
  | "too_long"
  | "missing_number"
  | "missing_name"
  | "missing_hedge"
  | "missing_jargon";

export type GuardResult =
  | { ok: true }
  | { ok: false; reasons: GuardFailureReason[] };

/** Numbers, percentages, currency amounts, and simple dates. */
export function extractProtectedNumbers(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|k|m|b))?/gi,
    /\b\d[\d,]*(?:\.\d+)?%/g,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b/gi,
    /\b\d{4}\b/g,
    /\b\d[\d,]*(?:\.\d+)?\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      found.add(match[0].replace(/\s+/g, " ").trim());
    }
  }
  return [...found];
}

const NAME_STOP = new Set([
  "The",
  "A",
  "An",
  "This",
  "That",
  "These",
  "Those",
  "It",
  "Its",
  "We",
  "They",
  "I",
  "In",
  "On",
  "At",
  "For",
  "And",
  "But",
  "Or",
  "If",
  "When",
  "After",
  "Before",
  "Very",
  "Due",
  "What",
]);

/** Capitalized names / product-like tokens (not sentence starters alone). */
export function extractCapitalizedNames(text: string): string[] {
  const words = text.match(/\b[A-Z][A-Za-z0-9]+(?:[ '-][A-Z][A-Za-z0-9]+)*\b/g) ?? [];
  const out = new Set<string>();
  for (const word of words) {
    if (NAME_STOP.has(word)) continue;
    if (word.length < 2) continue;
    out.add(word);
  }
  return [...out];
}

function normalizeLoose(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function containsLoose(haystack: string, needle: string): boolean {
  return normalizeLoose(haystack).includes(normalizeLoose(needle));
}

export function validateRewrite(original: string, rewritten: string): GuardResult {
  const reasons: GuardFailureReason[] = [];
  const next = rewritten.trim();
  if (!next) reasons.push("empty");
  if (next.length > Math.max(original.length * 1.8, original.length + 80)) {
    reasons.push("too_long");
  }

  for (const number of extractProtectedNumbers(original)) {
    if (!containsLoose(next, number)) reasons.push("missing_number");
  }
  for (const name of extractCapitalizedNames(original)) {
    if (!next.includes(name)) reasons.push("missing_name");
  }
  const originalLower = original.toLowerCase();
  const rewrittenLower = next.toLowerCase();
  for (const hedge of HEDGES) {
    const re = new RegExp(`\\b${hedge}\\b`, "i");
    if (re.test(originalLower) && !re.test(rewrittenLower)) reasons.push("missing_hedge");
  }
  for (const term of AI_JARGON) {
    const re = new RegExp(`\\b${term}\\b`, "i");
    if (re.test(original) && !re.test(next)) reasons.push("missing_jargon");
  }

  const unique = [...new Set(reasons)];
  if (unique.length === 0) return { ok: true };
  return { ok: false, reasons: unique };
}
