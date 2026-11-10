import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  BriefInsufficientSourcesError,
  generateGroundedBrief,
} from "@/lib/brief";
import { listSources } from "@/lib/sources";
import { LlmConfigError, LlmRateLimitError, LlmTimeoutError } from "@/lib/llm";
import { BriefRequestSchema, SourceSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const BRIEF_DEADLINE_MS = 45_000;

export async function POST(request: Request) {
  let body: unknown = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIEF_DEADLINE_MS);
  const onAbort = () => controller.abort();
  request.signal.addEventListener("abort", onAbort);

  try {
    const parsed = BriefRequestSchema.parse(
      body === null || body === undefined || body === "" ? undefined : body
    );

    const all = await listSources();
    const filtered =
      parsed?.source_ids && parsed.source_ids.length > 0
        ? all.filter((source) => parsed.source_ids!.includes(source.id))
        : all;

    const sources = filtered.map((source) => SourceSchema.parse(source));
    const result = await generateGroundedBrief(sources, { signal: controller.signal });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BriefInsufficientSourcesError) {
      return NextResponse.json(
        { error: err.message, code: "insufficient_sources" },
        { status: 400 }
      );
    }
    if (
      err instanceof LlmTimeoutError ||
      (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
    ) {
      return NextResponse.json(
        { error: "timeout", retryable: true },
        { status: 504 }
      );
    }
    if (err instanceof LlmRateLimitError) {
      return NextResponse.json(
        { error: err.message, code: "rate_limited", retryable: true },
        { status: 429 }
      );
    }
    if (err instanceof LlmConfigError) {
      return NextResponse.json({ error: err.message, retryable: false }, { status: 500 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "The model returned a brief that failed validation.", retryable: true },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Brief generation failed";
    console.error("[brief]", message);
    return NextResponse.json({ error: message, retryable: true }, { status: 500 });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
  }
}
