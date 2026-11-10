import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ingestSource } from "@/lib/ingest";
import { IngestRequestSchema, IngestResponseSchema } from "@/lib/schemas";
import {
  assertIngestTextSize,
  assertSafePublicUrl,
  checkIngestRateLimit,
  UrlSafetyError,
} from "@/lib/url-safety";

export const runtime = "nodejs";
export const maxDuration = 30;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(request: Request) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "INGEST_TOKEN is not configured on the server." },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token || token !== expected) {
    return unauthorized();
  }

  const rate = checkIngestRateLimit(token);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 250_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const parsed = IngestRequestSchema.parse(body);
    assertSafePublicUrl(parsed.url);
    assertIngestTextSize(parsed.text);
    const source = await ingestSource(parsed);
    return NextResponse.json(IngestResponseSchema.parse({ source }));
  } catch (err) {
    if (err instanceof UrlSafetyError || err instanceof ZodError) {
      const message =
        err instanceof UrlSafetyError ? err.message : "Invalid URL. Only public http(s) URLs are allowed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Ingest failed";
    console.error("[ingest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
