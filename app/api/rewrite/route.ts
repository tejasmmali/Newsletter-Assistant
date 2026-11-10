import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LlmRateLimitError, LlmTimeoutError } from "@/lib/llm";
import { rewriteIssues } from "@/lib/rewrite";
import { RewriteRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = RewriteRequestSchema.parse(body);
    const result = await rewriteIssues(input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 400 }
      );
    }
    if (err instanceof LlmRateLimitError) {
      return NextResponse.json(
        { error: err.message, code: "rate_limited", retryable: true },
        { status: 429 }
      );
    }
    if (err instanceof LlmTimeoutError) {
      return NextResponse.json(
        { error: "timeout", retryable: true },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : "Rewrite failed";
    console.error("[rewrite]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
