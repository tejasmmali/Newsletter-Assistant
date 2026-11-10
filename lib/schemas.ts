import { z } from "zod";

export const SourceStatusSchema = z.enum([
  "ok",
  "needs_manual_text",
  "error",
]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const SourceSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string().nullable(),
  text: z.string().nullable(),
  note: z.string().nullable().optional(),
  status: SourceStatusSchema,
  error: z.string().nullable(),
  created_at: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;

export const IngestRequestSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).optional(),
  text: z.string().min(1).max(200_000).optional(),
  note: z.string().max(2_000).optional(),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestResponseSchema = z.object({
  source: SourceSchema,
});
export type IngestResponse = z.infer<typeof IngestResponseSchema>;

export const BulkIngestRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1),
});
export type BulkIngestRequest = z.infer<typeof BulkIngestRequestSchema>;

/** Minimum extracted/pasted character count to count as a valid source. */
export const MIN_SOURCE_TEXT_CHARS = 200;

/** Minimum ready sources required before brief generation. */
export const MIN_BRIEF_SOURCES = 3;

/** Soft word cap per source sent to the LLM outside the brief path. */
export const MAX_SOURCE_WORDS_FOR_LLM = 8000;

/** Brief prompts keep each source shorter so generation finishes inside the function limit. */
export const BRIEF_SOURCE_WORDS = 3000;

export const MAX_BRIEF_CLAIMS = 12;
export const MIN_STORY_ANGLES = 2;
export const MAX_STORY_ANGLES = 3;

export const ClaimTypeSchema = z.enum(["fact", "analysis", "speculation"]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const BriefClaimSchema = z.object({
  text: z.string().min(1),
  type: ClaimTypeSchema,
  source_id: z.string().uuid(),
  supporting_quote: z.string(),
});
export type BriefClaim = z.infer<typeof BriefClaimSchema>;

export const GroundedClaimSchema = BriefClaimSchema.extend({
  verified: z.boolean(),
  downgrade_note: z.string().optional(),
});
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;

export const PerSourceSchema = z.object({
  source_id: z.string().uuid(),
  summary: z.string().min(1),
  why_it_matters: z.string().min(1),
  who_should_care: z.array(z.string()).min(1).max(4),
});

export const StoryAngleSchema = z.object({
  headline: z.string().min(1),
  rationale: z.string().min(1),
});

export const CrossSourceSchema = z.object({
  agreements: z.array(z.string()),
  contradictions: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const BriefSchema = z.object({
  what_happened: z.string().min(1),
  per_source: z.array(PerSourceSchema).min(1),
  claims: z.array(BriefClaimSchema).min(1).max(MAX_BRIEF_CLAIMS),
  story_angles: z.array(StoryAngleSchema).min(MIN_STORY_ANGLES).max(MAX_STORY_ANGLES),
  recommended_angle: z.string().min(1),
  reasoning: z.string().min(1),
  cross_source: CrossSourceSchema,
});
export type Brief = z.infer<typeof BriefSchema>;

export const GroundedBriefSchema = BriefSchema.extend({
  claims: z.array(GroundedClaimSchema).min(1).max(MAX_BRIEF_CLAIMS),
});
export type GroundedBrief = z.infer<typeof GroundedBriefSchema>;

export const BriefMetaSchema = z.object({
  source_count: z.number().int().nonnegative(),
  verified_claims: z.number().int().nonnegative(),
  unverified_claims: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative().optional(),
});
export type BriefMeta = z.infer<typeof BriefMetaSchema>;

export const BriefResponseSchema = z.object({
  brief: GroundedBriefSchema,
  meta: BriefMetaSchema,
});
export type BriefResponse = z.infer<typeof BriefResponseSchema>;

export const BriefRequestSchema = z
  .object({
    source_ids: z.array(z.string().uuid()).optional(),
  })
  .optional();
export type BriefRequest = z.infer<typeof BriefRequestSchema>;

export const RewriteIssueSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  severity: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  original: z.string(),
  explanation: z.string().min(1),
  suggestion: z.string().optional(),
});

export const RewriteRequestSchema = z.object({
  draft: z.string().min(1),
  issues: z.array(RewriteIssueSchema).min(1).max(15),
});
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;

export const RewriteLlmItemSchema = z.object({
  issue_id: z.string().min(1),
  rewritten: z.string(),
  rationale: z.string().min(1),
});

export const RewriteLlmResponseSchema = z.object({
  rewrites: z.array(RewriteLlmItemSchema),
});
export type RewriteLlmResponse = z.infer<typeof RewriteLlmResponseSchema>;

export const RewriteResultSchema = z.object({
  issue_id: z.string().min(1),
  rewritten: z.string(),
  rationale: z.string().optional(),
  guard_rejected: z.boolean().optional(),
  label: z.string().optional(),
});
export type RewriteResult = z.infer<typeof RewriteResultSchema>;

export const RewriteResponseSchema = z.object({
  rewrites: z.array(RewriteResultSchema),
  notice: z.string().nullable().optional(),
});
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;
