export type TextSpan = {
  text: string;
  start: number;
  end: number;
};

export type SentenceSpan = TextSpan & {
  words: TextSpan[];
};

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
  "a.m",
  "p.m",
  "inc",
  "ltd",
  "co",
  "corp",
  "dept",
  "approx",
  "fig",
  "al",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "of",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "his",
  "her",
  "i",
  "me",
  "my",
]);

export function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(normalizeToken(word));
}

export function splitWords(text: string, base = 0): TextSpan[] {
  const spans: TextSpan[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.replace(/^[^\w$]+|[^\w%]+$/g, "");
    if (!trimmed) continue;
    const local = raw.indexOf(trimmed);
    const start = base + match.index + local;
    const end = start + trimmed.length;
    spans.push({ text: trimmed, start, end });
  }
  return spans;
}

function wordBeforeDot(input: string, dotIndex: number): string {
  let i = dotIndex - 1;
  while (i >= 0 && /[A-Za-z.]/.test(input[i] ?? "")) i -= 1;
  return input.slice(i + 1, dotIndex).toLowerCase();
}

function isAbbreviationOrDecimal(input: string, dotIndex: number): boolean {
  const prev = input[dotIndex - 1] ?? "";
  const next = input[dotIndex + 1] ?? "";
  if (/\d/.test(prev) && /\d/.test(next)) return true;
  if (/[A-Za-z]/.test(next)) return true;
  const word = wordBeforeDot(input, dotIndex).replace(/\./g, "");
  const dotted = wordBeforeDot(input, dotIndex);
  return ABBREVIATIONS.has(word) || ABBREVIATIONS.has(dotted);
}

function pushTrimmed(
  input: string,
  rawStart: number,
  rawEnd: number,
  out: SentenceSpan[]
): void {
  let start = rawStart;
  let end = rawEnd;
  while (start < end && /\s/.test(input[start] ?? "")) start += 1;
  while (end > start && /\s/.test(input[end - 1] ?? "")) end -= 1;
  if (start >= end) return;
  const text = input.slice(start, end);
  out.push({ text, start, end, words: splitWords(input.slice(start, end), start) });
}

export function splitSentences(input: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "…") continue;
    if (ch === "." && input.slice(i, i + 3) === "...") {
      i += 2;
      continue;
    }
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (ch === "." && isAbbreviationOrDecimal(input, i)) continue;
    pushTrimmed(input, start, i + 1, spans);
    start = i + 1;
  }
  if (start < input.length) pushTrimmed(input, start, input.length, spans);
  return spans;
}

export function splitParagraphs(input: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const re = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const rawStart = match.index;
    const rawEnd = rawStart + match[0].length;
    let start = rawStart;
    let end = rawEnd;
    while (start < end && /\s/.test(input[start] ?? "")) start += 1;
    while (end > start && /\s/.test(input[end - 1] ?? "")) end -= 1;
    if (start >= end) continue;
    spans.push({ text: input.slice(start, end), start, end });
    if (match[0].length === 0) break;
  }
  return spans;
}

export type SkipRange = { start: number; end: number };

export function findSkipRanges(text: string): SkipRange[] {
  const ranges: SkipRange[] = [];
  const patterns = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /https?:\/\/\S+/g,
    /"[^"\n]+"/g,
    /“[^”\n]+”/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

export function rangeOverlapsMask(
  start: number,
  end: number,
  ranges: SkipRange[]
): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}
