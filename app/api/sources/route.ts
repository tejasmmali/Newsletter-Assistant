import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ingestSource } from "@/lib/ingest";
import { listSources } from "@/lib/sources";
import { IngestRequestSchema, zArrayOfSources } from "@/lib/api-helpers";
import { UrlSafetyError, assertSafePublicUrl } from "@/lib/url-safety";

export const runtime = "nodejs";
export const maxDuration = 60;

function invalidUrl(message: string) {
  return NextResponse.json({ error: "invalid_url", message }, { status: 400 });
}

/**
 * UI-facing sources API (no Bearer token).
 * Bookmarklet/extension should use POST /api/ingest with INGEST_TOKEN.
 */
export async function GET() {
  try {
    const sources = await listSources();
    return NextResponse.json({ sources: zArrayOfSources.parse(sources) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list sources";
    console.error("[sources:GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (
      typeof body === "object" &&
      body !== null &&
      "urls" in body &&
      Array.isArray((body as { urls: unknown }).urls)
    ) {
      const urls = (body as { urls: unknown[] }).urls
        .filter((url): url is string => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean);

      if (urls.length === 0) {
        return NextResponse.json(
          { error: "invalid_url", message: "Provide at least one URL." },
          { status: 400 }
        );
      }

      for (const url of urls) {
        assertSafePublicUrl(url);
      }

      const sources = [];
      for (const url of urls) {
        sources.push(await ingestSource({ url }));
      }
      return NextResponse.json({ sources: zArrayOfSources.parse(sources) });
    }

    const parsed = IngestRequestSchema.parse(body);
    assertSafePublicUrl(parsed.url);
    const source = await ingestSource(parsed);
    return NextResponse.json({ source });
  } catch (err) {
    if (err instanceof UrlSafetyError) return invalidUrl(err.message);
    if (err instanceof ZodError) {
      return invalidUrl("That URL is not a public http(s) address.");
    }
    const message = err instanceof Error ? err.message : "Ingest failed";
    console.error("[sources:POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
