import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { updateSourceManualText } from "@/lib/ingest";
import { SourceSchema } from "@/lib/schemas";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ManualTextBodySchema = z.object({
  text: z.string().min(1),
  title: z.string().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("sources").delete().eq("id", idResult.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const { text, title } = ManualTextBodySchema.parse(body);
    const source = await updateSourceManualText(idResult.data, text, title);
    return NextResponse.json({ source: SourceSchema.parse(source) });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Update failed";
    console.error("[sources:PATCH]", message);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
