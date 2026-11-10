import { validateRewrite } from "@/lib/rewrite-guard";
import { generateJson, LlmRateLimitError } from "@/lib/llm";
import {
  RewriteLlmResponseSchema,
  RewriteResponseSchema,
  type RewriteRequest,
  type RewriteResponse,
  type RewriteResult,
} from "@/lib/schemas";

const REWRITE_SYSTEM = `You are a careful copy editor for a technical AI newsletter.
For each issue, propose a MINIMAL rewrite of ONLY the provided passage.

Hard rules:
- Preserve meaning, facts, numbers, names, product names, technical terms, hedging, and the author's voice.
- Change as little as possible.
- Do NOT auto-simplify or replace technical terms.
- If no safe improvement exists, return the original passage unchanged.
- Return JSON only: { "rewrites": [{ "issue_id", "rewritten", "rationale" }] }
- rationale must be one short line.`;

function buildPrompt(req: RewriteRequest): string {
  const payload = req.issues.map((issue) => ({
    issue_id: issue.id,
    type: issue.type,
    severity: issue.severity,
    explanation: issue.explanation,
    passage: issue.original,
    deterministic_suggestion: issue.suggestion ?? null,
  }));

  return `Draft context (for reference; rewrite ONLY each passage):
"""
${req.draft.slice(0, 4000)}
"""

Issues to rewrite (${payload.length}):
${JSON.stringify(payload, null, 2)}`;
}

function fallbackForIssue(
  issue: RewriteRequest["issues"][number],
  noticeReason: "guard" | "missing"
): RewriteResult {
  if (issue.suggestion !== undefined) {
    const guard = validateRewrite(issue.original, issue.suggestion);
    if (guard.ok) {
      return {
        issue_id: issue.id,
        rewritten: issue.suggestion,
        rationale: "Deterministic suggestion.",
        guard_rejected: false,
        label: "rule",
      };
    }
  }
  return {
    issue_id: issue.id,
    rewritten: issue.original,
    rationale:
      noticeReason === "guard"
        ? "Rejected by the rewrite guard. Original kept."
        : "No model rewrite. Original kept.",
    guard_rejected: noticeReason === "guard",
    label: noticeReason === "guard" ? "guard" : "unchanged",
  };
}

export async function rewriteIssues(req: RewriteRequest): Promise<RewriteResponse> {
  let llm;
  try {
    llm = await generateJson(buildPrompt(req), RewriteLlmResponseSchema, {
      system: REWRITE_SYSTEM,
    });
  } catch (err) {
    if (err instanceof LlmRateLimitError) throw err;
    throw err;
  }

  const byId = new Map(llm.rewrites.map((item) => [item.issue_id, item]));
  let rejected = 0;
  const rewrites: RewriteResult[] = req.issues.map((issue) => {
    const proposed = byId.get(issue.id);
    if (!proposed) {
      return fallbackForIssue(issue, "missing");
    }
    const guard = validateRewrite(issue.original, proposed.rewritten);
    if (!guard.ok) {
      rejected += 1;
      const fallback = fallbackForIssue(issue, "guard");
      return {
        ...fallback,
        rationale: proposed.rationale,
        guard_rejected: true,
        label: "guard",
      };
    }
    return {
      issue_id: issue.id,
      rewritten: proposed.rewritten,
      rationale: proposed.rationale,
      guard_rejected: false,
    };
  });

  return RewriteResponseSchema.parse({
    rewrites,
    notice:
      rejected > 0
        ? `${rejected} rewrite(s) rejected by safety check. Numbers, names, hedges, and technical terms were kept.`
        : null,
  });
}
