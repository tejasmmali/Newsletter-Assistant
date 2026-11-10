import { z } from "zod";
import {
  findSkipRanges,
  isStopword,
  normalizeToken,
  rangeOverlapsMask,
  splitParagraphs,
  splitSentences,
  splitWords,
  type SentenceSpan,
} from "@/lib/text";

export const IssueSeveritySchema = z.enum(["low", "medium", "high"]);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

export const IssueTypeSchema = z.enum([
  "long_sentence",
  "passive_voice",
  "filler",
  "repetition",
  "dense_paragraph",
  "jargon",
]);
export type IssueType = z.infer<typeof IssueTypeSchema>;

export const IssueSchema = z.object({
  id: z.string().min(1),
  type: IssueTypeSchema,
  severity: IssueSeveritySchema,
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  original: z.string(),
  explanation: z.string().min(1),
  suggestion: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

const BE_VERBS = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
]);

const IRREGULAR_PARTICIPLES = new Set([
  "begun",
  "bent",
  "bound",
  "bitten",
  "blown",
  "broken",
  "brought",
  "built",
  "bought",
  "caught",
  "chosen",
  "come",
  "cut",
  "dealt",
  "done",
  "drawn",
  "driven",
  "drunk",
  "eaten",
  "fallen",
  "fed",
  "felt",
  "fought",
  "found",
  "flown",
  "forgotten",
  "forgiven",
  "frozen",
  "gotten",
  "given",
  "gone",
  "grown",
  "hung",
  "heard",
  "hidden",
  "hit",
  "held",
  "hurt",
  "kept",
  "known",
  "laid",
  "led",
  "left",
  "lost",
  "made",
  "meant",
  "met",
  "paid",
  "put",
  "read",
  "run",
  "said",
  "seen",
  "sold",
  "sent",
  "shown",
  "shut",
  "spoken",
  "spent",
  "stood",
  "taken",
  "told",
  "thought",
  "understood",
  "worn",
  "won",
  "written",
]);

/** Terms the rewrite guard must not drop. */
export const AI_JARGON = [
  "RLHF",
  "RLAIF",
  "MoE",
  "RAG",
  "LLM",
  "fine-tuning",
  "embeddings",
  "transformer",
  "agentic",
] as const;

const FILLERS: Array<{ re: RegExp; suggestion?: string; explanation: string }> = [
  {
    re: /\bin order to\b/gi,
    suggestion: "to",
    explanation: "Filler. “to” says the same thing.",
  },
  {
    re: /\bdue to the fact that\b/gi,
    explanation: "Filler. “because” is tighter, but there is no automatic replacement.",
  },
  {
    re: /\bit is important to note that\b/gi,
    explanation: "Filler opening. Cut it and start with the fact.",
  },
  {
    re: /\bbasically\b/gi,
    explanation: "Filler adverb. Delete it unless the hedge is doing real work.",
  },
];

function issueFromSpan(
  text: string,
  type: IssueType,
  severity: IssueSeverity,
  start: number,
  end: number,
  explanation: string,
  suggestion?: string
): Issue {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from] ?? "")) from += 1;
  while (to > from && /\s/.test(text[to - 1] ?? "")) to -= 1;
  const original = text.slice(from, to);
  return {
    id: `${type}:${from}-${to}`,
    type,
    severity,
    start: from,
    end: to,
    original,
    explanation,
    ...(suggestion !== undefined ? { suggestion } : {}),
  };
}

function isParticiple(token: string): boolean {
  const word = normalizeToken(token);
  if (!word || BE_VERBS.has(word)) return false;
  if (IRREGULAR_PARTICIPLES.has(word)) return true;
  return word.endsWith("ed") && word.length > 3;
}

function addLongSentences(text: string, issues: Issue[], mask: ReturnType<typeof findSkipRanges>) {
  for (const sentence of splitSentences(text)) {
    const words = sentence.words.length;
    if (words <= 30) continue;
    if (rangeOverlapsMask(sentence.start, sentence.end, mask)) continue;
    issues.push(
      issueFromSpan(
        text,
        "long_sentence",
        words > 40 ? "high" : "medium",
        sentence.start,
        sentence.end,
        words > 40
          ? `This sentence is ${words} words. Split it so the point lands earlier.`
          : `This sentence is ${words} words. Consider a break after the main clause.`
      )
    );
  }
}

function addPassive(text: string, sentence: SentenceSpan, issues: Issue[]) {
  const words = sentence.words;
  for (let i = 0; i < words.length - 1; i += 1) {
    const be = normalizeToken(words[i]?.text ?? "");
    const next = words[i + 1];
    if (!next) continue;
    if (!BE_VERBS.has(be)) continue;
    if (!isParticiple(next.text)) continue;
    const start = words[i]!.start;
    const end = next.end;
    issues.push(
      issueFromSpan(
        text,
        "passive_voice",
        "low",
        start,
        end,
        "Passive construction. Name the actor if you know who did it."
      )
    );
  }
}

function addFillers(text: string, issues: Issue[], mask: ReturnType<typeof findSkipRanges>) {
  for (const filler of FILLERS) {
    filler.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = filler.re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (rangeOverlapsMask(start, end, mask)) continue;
      issues.push(
        issueFromSpan(
          text,
          "filler",
          "low",
          start,
          end,
          filler.explanation,
          filler.suggestion
        )
      );
    }
  }
}

function addRepetition(text: string, issues: Issue[], mask: ReturnType<typeof findSkipRanges>) {
  const words = splitWords(text);
  const counts = new Map<string, number>();
  for (const word of words) {
    const token = normalizeToken(word.text);
    if (token.length < 6 || isStopword(word.text)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  for (const word of words) {
    const token = normalizeToken(word.text);
    if ((counts.get(token) ?? 0) < 3) continue;
    const n = (seen.get(token) ?? 0) + 1;
    seen.set(token, n);
    if (n < 2) continue;
    if (rangeOverlapsMask(word.start, word.end, mask)) continue;
    issues.push(
      issueFromSpan(
        text,
        "repetition",
        "low",
        word.start,
        word.end,
        `“${word.text}” shows up ${counts.get(token)} times. Vary it or cut a repeat.`
      )
    );
  }
}

function addDenseParagraphs(text: string, issues: Issue[]) {
  for (const paragraph of splitParagraphs(text)) {
    const words = splitWords(paragraph.text);
    if (words.length < 80) continue;
    issues.push(
      issueFromSpan(
        text,
        "dense_paragraph",
        "medium",
        paragraph.start,
        paragraph.end,
        `This paragraph is ${words.length} words. Break it after the claim.`
      )
    );
  }
}

function addJargon(text: string, issues: Issue[], mask: ReturnType<typeof findSkipRanges>) {
  for (const term of AI_JARGON) {
    const re = new RegExp(`\\b${term.replace("-", "\\-")}\\b`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (rangeOverlapsMask(start, end, mask)) continue;
      issues.push(
        issueFromSpan(
          text,
          "jargon",
          "low",
          start,
          end,
          `“${match[0]}” may need a plain gloss for newsletter readers. Do not delete the term.`
        )
      );
    }
  }
}

export function analyzeDraft(text: string): Issue[] {
  if (!text.trim()) return [];
  const mask = findSkipRanges(text);
  const issues: Issue[] = [];
  addLongSentences(text, issues, mask);
  for (const sentence of splitSentences(text)) {
    if (rangeOverlapsMask(sentence.start, sentence.end, mask)) continue;
    addPassive(text, sentence, issues);
  }
  addFillers(text, issues, mask);
  addRepetition(text, issues, mask);
  addDenseParagraphs(text, issues);
  addJargon(text, issues, mask);

  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return issue.original.length > 0 && text.slice(issue.start, issue.end) === issue.original;
  });
}
