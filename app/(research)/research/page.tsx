import { headers } from "next/headers";
import { SourcesPanel } from "@/components/sources-panel";

export default async function ResearchPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  return <SourcesPanel origin={origin} />;
}
