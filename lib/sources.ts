import { SourceSchema, type Source } from "@/lib/schemas";
import { getServiceSupabase } from "@/lib/supabase";

export async function listSources(): Promise<Source[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase list failed: ${error.message}`);
  }

  return (data ?? []).map((row) => SourceSchema.parse(row));
}
