"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BriefMeta, GroundedBrief, Source } from "@/lib/schemas";

type ErrorState = { message: string; code: string | null };

function readFailure(body: unknown): ErrorState {
  if (body && typeof body === "object") {
    const record = body as { error?: unknown; code?: unknown; message?: unknown };
    const message =
      typeof record.message === "string" && record.message
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : "Brief generation failed";
    const code = typeof record.code === "string" ? record.code : null;
    return { message, code };
  }
  return { message: "Brief generation failed", code: null };
}

export function BriefPanel({ readyCount }: { readyCount: number }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorState | null>(null);
  const [brief, setBrief] = useState<GroundedBrief | null>(null);
  const [meta, setMeta] = useState<BriefMeta | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  const byId = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const canGenerate = readyCount >= 3 && !busy;

  async function generate() {
    setBusy(true);
    setFailure(null);
    try {
      const listResponse = await fetch("/api/sources");
      const listBody: unknown = await listResponse.json().catch(() => null);
      const list =
        listBody && typeof listBody === "object" && "sources" in listBody && Array.isArray(listBody.sources)
          ? (listBody.sources as Source[])
          : [];
      setSources(list);

      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body: unknown = await response.json().catch(() => {
        throw new Error("Brief generation failed");
      });
      if (!response.ok) {
        const parsed = readFailure(body);
        setFailure(parsed);
        return;
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("brief" in body) ||
        !("meta" in body)
      ) {
        throw new Error("Unexpected brief response shape.");
      }
      setBrief(body.brief as GroundedBrief);
      setMeta(body.meta as BriefMeta);
    } catch (err) {
      setBrief(null);
      setMeta(null);
      setFailure({
        message: err instanceof Error ? err.message : "Brief generation failed",
        code: null,
      });
    } finally {
      setBusy(false);
    }
  }

  function exportMarkdown() {
    if (!brief) return;
    const lines = [
      `# ${brief.recommended_angle}`,
      "",
      brief.what_happened,
      "",
      "## Claims",
      ...brief.claims.map((claim) => {
        const source = byId.get(claim.source_id);
        return `- [${claim.type}${claim.verified ? ", verified" : ", UNVERIFIED"}] ${claim.text}${source ? ` (${source.url})` : ""}`;
      }),
      "",
      "## Agreements",
      ...brief.cross_source.agreements.map((item) => `- ${item}`),
      "",
      "## Contradictions",
      ...brief.cross_source.contradictions.map((item) => `- ${item}`),
      "",
      "## Gaps",
      ...brief.cross_source.gaps.map((item) => `- ${item}`),
      "",
      "## Recommended angle",
      `**${brief.recommended_angle}**`,
      brief.reasoning,
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "research-brief.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Research brief</CardTitle>
          <CardDescription>
            {readyCount} ready sources. Generation stays on the server.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {brief ? (
            <Button type="button" variant="outline" size="sm" onClick={exportMarkdown}>
              Export Markdown
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={!canGenerate} onClick={() => void generate()}>
            {busy ? "Generating…" : brief ? "Regenerate" : "Generate brief"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {readyCount < 3 ? (
          <Alert>
            <AlertTitle>Not enough ready sources</AlertTitle>
            <AlertDescription>
              Fix sources marked “needs manual text” or ingest more. Brief generation is blocked until 3 sources are ready.
            </AlertDescription>
          </Alert>
        ) : null}
        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>{failure.code === "rate_limited" ? "Rate limited" : "Brief generation failed"}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{failure.message}</p>
              {failure.code === "rate_limited" ? <p>Try again in a minute (Gemini free tier).</p> : null}
              <Button type="button" size="sm" variant="outline" disabled={busy || readyCount < 3} onClick={() => void generate()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {meta ? (
          <p className="text-xs text-muted-foreground">
            {meta.source_count} sources · {meta.verified_claims} verified claims · {meta.unverified_claims} unverified
            {typeof meta.latency_ms === "number" ? ` · ${Math.round(meta.latency_ms / 1000)}s` : ""}
          </p>
        ) : null}
        {brief ? (
          <div className="space-y-4">
            <section>
              <h2 className="text-sm font-medium">What happened</h2>
              <p className="text-sm">{brief.what_happened}</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-medium">Per source</h2>
              {brief.per_source.map((item) => {
                const source = byId.get(item.source_id);
                return (
                  <div key={item.source_id} className="text-sm">
                    <p className="font-medium">{source?.title || item.source_id}</p>
                    <p>{item.summary}</p>
                  </div>
                );
              })}
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-medium">Claims</h2>
              {brief.claims.map((claim, index) => {
                const source = byId.get(claim.source_id);
                return (
                  <div key={`${claim.source_id}-${index}`} className="space-y-1 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">
                        {claim.type}
                      </Badge>
                      <Badge variant={claim.verified ? "secondary" : "outline"}>
                        {claim.verified ? "verified" : "unverified"}
                      </Badge>
                    </div>
                    <p>{claim.text}</p>
                    {!claim.verified ? (
                      <p className="text-xs text-amber-800">
                        {claim.downgrade_note ?? "unverified"} — fact downgraded to unverified
                      </p>
                    ) : null}
                    {source ? (
                      <a className="text-xs underline" href={source.url}>
                        {source.url}
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </section>
            <section>
              <h2 className="text-sm font-medium">Story angles</h2>
              <ul className="list-disc pl-5 text-sm">
                {brief.story_angles.map((angle) => (
                  <li key={angle.headline}>
                    {angle.headline}
                    {angle.headline === brief.recommended_angle ? " (recommended)" : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-medium">{brief.recommended_angle}</p>
              <p className="text-sm text-muted-foreground">{brief.reasoning}</p>
            </section>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
