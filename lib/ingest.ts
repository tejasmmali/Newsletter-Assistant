import { applyManualText, extractFromUrl, isXUrl } from "@/lib/extract";
import {
  IngestRequestSchema,
  SourceSchema,
  type IngestRequest,
  type Source,
} from "@/lib/schemas";
import { getServiceSupabase } from "@/lib/supabase";
import { assertIngestTextSize, assertSafePublicUrl } from "@/lib/url-safety";

export async function ingestSource(input: IngestRequest): Promise<Source> {
  const parsed = IngestRequestSchema.parse(input);
  assertSafePublicUrl(parsed.url);
  assertIngestTextSize(parsed.text);
  const { url, note } = parsed;
  let title = parsed.title ?? null;

  let status: Source["status"];
  let text: string | null = null;
  let error: string | null = null;

  if (parsed.text) {
    const manual = applyManualText(parsed.text, title);
    status = manual.status;
    title = manual.title;
    text = manual.text;
    error = manual.status === "ok" ? null : manual.error;
  } else if (isXUrl(url)) {
    status = "needs_manual_text";
    error = "X/Twitter URLs cannot be scraped reliably. Paste the tweet text manually.";
  } else {
    const extracted = await extractFromUrl(url);
    status = extracted.status;
    title = title ?? extracted.title;
    text = extracted.text;
    error = extracted.status === "ok" ? null : extracted.error;
  }

  const supabase = getServiceSupabase();
  const { data, error: dbError } = await supabase
    .from("sources")
    .insert({
      url,
      title,
      text,
      note: note ?? null,
      status,
      error,
    })
    .select("*")
    .single();

  if (dbError || !data) {
    throw new Error(dbError?.message ?? "Insert failed");
  }
  return SourceSchema.parse(data);
}

export async function updateSourceManualText(
  id: string,
  text: string,
  title?: string
): Promise<Source> {
  const supabase = getServiceSupabase();
  const { data: existing, error: readError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Source not found");

  const manual = applyManualText(text, title ?? existing.title ?? null);
  const { data, error } = await supabase
    .from("sources")
    .update({
      title: manual.title,
      text: manual.text,
      status: manual.status,
      error: manual.status === "ok" ? null : manual.error,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Update failed");
  return SourceSchema.parse(data);
}
