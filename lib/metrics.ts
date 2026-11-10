import { splitSentences, splitWords } from "@/lib/text";

export type LongestSentence = {
  text: string;
  words: number;
};

export type DraftMetrics = {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  longestSentence: LongestSentence;
  readingTimeMin: number;
  fleschReadingEase: number;
};

export const METRIC_HELP = {
  wordCount: "Total words in the draft (numbers and hyphenated tokens count).",
  sentenceCount: "Sentences detected after handling abbreviations and decimals.",
  avgSentenceLength:
    "Average words per sentence — lower often reads faster, but technical writing can run longer on purpose.",
  longestSentence:
    "The longest sentence by word count; a quick flag for buried ideas.",
  readingTimeMin:
    "Estimated minutes to read at ~225 words per minute (skimming is faster).",
  fleschReadingEase:
    "0–100 style score from sentence and syllable length; higher ≈ easier. Rough signal only — technical prose can score low and still be clear.",
} as const satisfies Record<keyof DraftMetrics, string>;

const WPM = 225;

/** Rough syllable count for Flesch (English heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  let syllables = 0;
  const vowels = /[aeiouy]+/g;
  const groups = w.match(vowels);
  syllables = groups ? groups.length : 0;

  if (w.endsWith("e")) syllables -= 1;
  if (syllables < 1) syllables = 1;
  return syllables;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeMetrics(text: string): DraftMetrics {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      longestSentence: { text: "", words: 0 },
      readingTimeMin: 0,
      fleschReadingEase: 0,
    };
  }

  const sentences = splitSentences(trimmed);
  const words = splitWords(trimmed);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word.text), 0);
  let longest = { text: "", words: 0 };
  for (const sentence of sentences) {
    if (sentence.words.length > longest.words) {
      longest = { text: sentence.text, words: sentence.words.length };
    }
  }
  if (!longest.text && words.length > 0) {
    longest = { text: trimmed, words: wordCount };
  }

  const avgSentenceLength = wordCount === 0 ? 0 : round1(wordCount / sentenceCount);
  const flesch =
    wordCount === 0
      ? 0
      : 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);

  return {
    wordCount,
    sentenceCount: sentences.length,
    avgSentenceLength,
    longestSentence: longest,
    readingTimeMin: Math.round(wordCount / WPM),
    fleschReadingEase: Number.isFinite(flesch) ? round1(Math.max(0, Math.min(100, flesch))) : 0,
  };
}
