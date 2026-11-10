import { groundBrief } from "@/lib/grounding";
import { generateJson } from "@/lib/llm";
import {
  BriefSchema,
  BriefResponseSchema,
  BRIEF_SOURCE_WORDS,
  MAX_BRIEF_CLAIMS,
  MAX_SOURCE_WORDS_FOR_LLM,
  MAX_STORY_ANGLES,
  MIN_BRIEF_SOURCES,
  MIN_STORY_ANGLES,
  type BriefResponse,
  type Source,
} from "@/lib/schemas";

export function truncateToWords(
  text: string,
  maxWords = MAX_SOURCE_WORDS_FOR_LLM
): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

export function selectValidSources(sources: Source[]): Source[] {
  return sources.filter(
    (source) =>
      source.status === "ok" && typeof source.text === "string" && source.text.length > 0
  );
}

export class BriefInsufficientSourcesError extends Error {
  readonly ready: number;

  constructor(ready: number) {
    super(`Not enough ready sources (${ready}). Need at least ${MIN_BRIEF_SOURCES}.`);
    this.name = "BriefInsufficientSourcesError";
    this.ready = ready;
  }
}

const BRIEF_SYSTEM = `You are an editorial research assistant for the newsletter "This Week in AI".
Your job is to find a story worth telling for founders, builders, and operators — not to summarize.

Hard rules:
- Use ONLY the provided source texts. Do not invent facts or use outside knowledge.
- Every claim of type "fact" MUST include a supporting_quote that is a verbatim excerpt from that source's text.
- Anything inferred from the text (not explicitly stated) must be type "analysis".
- Forecasts, opinions, and forward-looking statements must be type "speculation".
- If evidence is thin, say "insufficient evidence" rather than guessing.
- Cap claims at ${MAX_BRIEF_CLAIMS}. Prefer the claims a newsletter can actually check.
- per_source.summary is 2 or 3 sentences, not a recap of the whole piece.
- Produce ${MIN_STORY_ANGLES} or ${MAX_STORY_ANGLES} distinct story_angles. No more.
- recommended_angle must be the headline of one story_angles entry.
- Note disagreements on figures (losses, revenue, valuation) inside cross_source.contradictions.
- Tag IPO timing and valuation targets as speculation, not fact.
- Return JSON only matching the schema.`;

/** Constrains Gemini JSON mode to the brief shape and the real source ids. */
export function briefResponseSchema(sourceIds: string[]) {
  const sourceId = { type: "string", enum: sourceIds };
  return {
    type: "object",
    properties: {
      what_happened: { type: "string" },
      per_source: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            source_id: sourceId,
            summary: { type: "string" },
            why_it_matters: { type: "string" },
            who_should_care: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          },
          required: ["source_id", "summary", "why_it_matters", "who_should_care"],
        },
      },
      claims: {
        type: "array",
        minItems: 1,
        maxItems: MAX_BRIEF_CLAIMS,
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            type: { type: "string", enum: ["fact", "analysis", "speculation"] },
            source_id: sourceId,
            supporting_quote: { type: "string" },
          },
          required: ["text", "type", "source_id", "supporting_quote"],
        },
      },
      story_angles: {
        type: "array",
        minItems: MIN_STORY_ANGLES,
        maxItems: MAX_STORY_ANGLES,
        items: {
          type: "object",
          properties: {
            headline: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["headline", "rationale"],
        },
      },
      recommended_angle: { type: "string" },
      reasoning: { type: "string" },
      cross_source: {
        type: "object",
        properties: {
          agreements: { type: "array", items: { type: "string" } },
          contradictions: { type: "array", items: { type: "string" } },
          gaps: { type: "array", items: { type: "string" } },
        },
        required: ["agreements", "contradictions", "gaps"],
      },
    },
    required: [
      "what_happened",
      "per_source",
      "claims",
      "story_angles",
      "recommended_angle",
      "reasoning",
      "cross_source",
    ],
  };
}

function buildPrompt(sources: Source[]): string {
  const blocks = sources.map((source, index) => {
    const body = truncateToWords(source.text ?? "", BRIEF_SOURCE_WORDS);
    return [
      `SOURCE ${index + 1}`,
      `id: ${source.id}`,
      `url: ${source.url}`,
      `title: ${source.title ?? "(untitled)"}`,
      "text:",
      body,
    ].join("\n");
  });
  return `Sources (${sources.length}). Each text is truncated to about ${BRIEF_SOURCE_WORDS} words.\n\n${blocks.join("\n\n")}`;
}

export async function generateGroundedBrief(
  sources: Source[],
  options: { signal?: AbortSignal } = {}
): Promise<BriefResponse> {
  const ready = selectValidSources(sources);
  if (ready.length < MIN_BRIEF_SOURCES) {
    throw new BriefInsufficientSourcesError(ready.length);
  }

  const started = Date.now();
  const brief = await generateJson(buildPrompt(ready), BriefSchema, {
    system: BRIEF_SYSTEM,
    signal: options.signal,
    responseJsonSchema: briefResponseSchema(ready.map((source) => source.id)),
  });
  const grounded = groundBrief(brief, ready);
  const verified = grounded.claims.filter((claim) => claim.verified).length;
  return BriefResponseSchema.parse({
    brief: grounded,
    meta: {
      source_count: ready.length,
      verified_claims: verified,
      unverified_claims: grounded.claims.length - verified,
      latency_ms: Date.now() - started,
    },
  });
}
