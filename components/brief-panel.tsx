"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { onCommand } from "@/components/commands";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BriefMeta, GroundedBrief, GroundedClaim, Source } from "@/lib/schemas";

type ErrorState = { message: string; code: string | null };
type ClaimFilter = "all" | "fact" | "analysis" | "speculation" | "unverified";

const STATUS_LINES = [
  "Reading the sources",
  "Checking quotes against the text",
  "Choosing story angles",
];

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

function markdownFor(brief: GroundedBrief, byId: Map<string, Source>) {
  return [
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
  ].join("\n");
}

function typeBadge(claim: GroundedClaim) {
  if (!claim.verified) return "border-destructive text-destructive";
  if (claim.type === "speculation") return "border-warning text-warning";
  if (claim.type === "analysis") return "border-foreground text-foreground";
  return "border-foreground bg-foreground text-background";
}

export function BriefPanel({ readyCount }: { readyCount: number }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorState | null>(null);
  const [brief, setBrief] = useState<GroundedBrief | null>(null);
  const [meta, setMeta] = useState<BriefMeta | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [filter, setFilter] = useState<ClaimFilter>("all");
  const router = useRouter();

  const byId = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const canGenerate = readyCount >= 3 && !busy;

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    const rotator = window.setInterval(() => setStatusIndex((index) => (index + 1) % STATUS_LINES.length), 4000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(rotator);
    };
  }, [busy]);

  const exportMarkdown = useCallback(() => {
    if (!brief) {
      toast("Generate a brief first.");
      return;
    }
    const blob = new Blob([markdownFor(brief, byId)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "research-brief.md";
    anchor.click();
    URL.revokeObjectURL(url);
    toast("Markdown downloaded.");
  }, [brief, byId]);

  async function copyMarkdown() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(markdownFor(brief, byId));
      toast("Brief copied.");
    } catch {
      toast.error("Could not copy the brief.");
    }
  }

  useEffect(() => onCommand("export-brief", exportMarkdown), [exportMarkdown]);

  async function generate() {
    setBusy(true);
    setFailure(null);
    setElapsed(0);
    setStatusIndex(0);
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
        toast.error(parsed.code === "rate_limited" ? "Rate limited" : "Brief generation failed");
        return;
      }
      if (!body || typeof body !== "object" || !("brief" in body) || !("meta" in body)) {
        throw new Error("Unexpected brief response shape.");
      }
      setBrief(body.brief as GroundedBrief);
      setMeta(body.meta as BriefMeta);
      toast("Brief ready.");
    } catch (err) {
      setBrief(null);
      setMeta(null);
      const message = err instanceof Error ? err.message : "Brief generation failed";
      setFailure({ message, code: null });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const claims = brief?.claims.filter((claim) => {
    if (filter === "all") return true;
    if (filter === "unverified") return !claim.verified;
    return claim.type === filter;
  }) ?? [];

  function applyAngle(headline: string) {
    sessionStorage.setItem("twai-angle", headline);
    window.dispatchEvent(new Event("twai-angle"));
    router.push("/write");
  }

  const generateButton = (
    <Button type="button" size="sm" disabled={!canGenerate} onClick={() => void generate()}>
      {busy ? "Generating…" : brief ? "Regenerate" : "Generate brief"}
    </Button>
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="step-brief" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="step-brief" className="font-mono text-[10px] tracking-widest uppercase">
              02 Brief
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {readyCount} ready sources. Generation stays on the server.
            </p>
          </div>
          {canGenerate ? (
            generateButton
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex">{generateButton}</span>
              </TooltipTrigger>
              <TooltipContent>
                {busy ? "A brief is already running." : "Need 3 ready sources before generating."}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

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

        {busy ? (
          <div className="space-y-3" aria-live="polite">
            <p className="font-mono text-xs text-muted-foreground">
              {STATUS_LINES[statusIndex]} · {elapsed}s
            </p>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {meta ? (
          <p className="font-mono text-xs text-muted-foreground">
            {meta.source_count} sources · {meta.verified_claims} verified claims · {meta.unverified_claims} unverified
            {typeof meta.latency_ms === "number" ? ` · ${Math.round(meta.latency_ms / 1000)}s` : ""}
          </p>
        ) : null}

        {brief ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <p className="font-mono text-[10px] tracking-widest uppercase">What happened</p>
                <CardTitle className="font-serif text-2xl font-normal">{brief.recommended_angle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6">{brief.what_happened}</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-widest uppercase">Per source</p>
              {brief.per_source.map((item) => {
                const source = byId.get(item.source_id);
                return (
                  <Collapsible key={item.source_id}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between border border-border px-3 py-2 text-left text-sm">
                      <span>{source?.title || item.source_id}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">Open</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border border-t-0 border-border px-3 py-2 text-sm">
                      <p>{item.summary}</p>
                      <p className="mt-2 text-muted-foreground">{item.why_it_matters}</p>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-widest uppercase">Cross source</p>
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["Agreements", brief.cross_source.agreements],
                    ["Contradictions", brief.cross_source.contradictions],
                    ["Gaps", brief.cross_source.gaps],
                  ] as const
                ).map(([label, items]) => (
                  <div key={label} className="border border-border p-3">
                    <p className="font-mono text-[10px] tracking-widest uppercase">{label}</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {items.length === 0 ? <li className="text-muted-foreground">None noted.</li> : null}
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-widest uppercase">Claims</p>
              <div className="flex flex-wrap gap-1">
                {(["all", "fact", "analysis", "speculation", "unverified"] as const).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={filter === chip}
                    className={`border px-2 py-1 font-mono text-[10px] tracking-wide uppercase ${filter === chip ? "border-foreground" : "border-border text-muted-foreground"}`}
                    onClick={() => setFilter(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Claim</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim, index) => {
                      const source = byId.get(claim.source_id);
                      return (
                        <TableRow key={`${claim.source_id}-${index}`}>
                          <TableCell>
                            <Badge variant="outline" className={typeBadge(claim)}>
                              {claim.verified ? claim.type : "unverified"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p>{claim.text}</p>
                            {claim.verified ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="mt-1 inline-flex items-center gap-1 text-verified">
                                    <Check className="size-3" aria-hidden /> verified
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{claim.supporting_quote || "Quote matched the source."}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <p className="mt-1 text-xs text-destructive">
                                {claim.downgrade_note ?? "unverified"} — fact downgraded to unverified
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {source ? (
                              <a className="inline-flex items-center gap-1 underline-offset-4 hover:underline" href={source.url}>
                                Link <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {claims.map((claim, index) => {
                  const source = byId.get(claim.source_id);
                  return (
                    <article key={`${claim.source_id}-card-${index}`} className="border border-border p-3 text-sm">
                      <Badge variant="outline" className={typeBadge(claim)}>
                        {claim.verified ? claim.type : "unverified"}
                      </Badge>
                      <p className="mt-2">{claim.text}</p>
                      {claim.verified ? (
                        <p className="mt-1 text-xs text-verified">verified</p>
                      ) : (
                        <p className="mt-1 text-xs text-destructive">unverified</p>
                      )}
                      {source ? (
                        <a className="mt-2 inline-block text-xs underline" href={source.url}>
                          {source.url}
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="step-angle" className="space-y-3">
        <h2 id="step-angle" className="font-mono text-[10px] tracking-widest uppercase">
          03 Angle
        </h2>
        {brief ? (
          <div className="grid gap-3">
            {brief.story_angles.map((angle) => {
              const recommended = angle.headline === brief.recommended_angle;
              return (
                <article key={angle.headline} className="border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {recommended ? (
                      <Badge>Recommended</Badge>
                    ) : null}
                    <h3 className="font-serif text-xl">{angle.headline}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{angle.rationale}</p>
                  {recommended ? <p className="mt-2 text-sm">{brief.reasoning}</p> : null}
                  <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => applyAngle(angle.headline)}>
                    Use in Writing Assistant
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Angles appear after a brief is generated.</p>
        )}
      </section>

      {brief ? (
        <div className="sticky bottom-0 z-20 flex flex-wrap gap-2 border-t border-border bg-background py-3">
          <Button type="button" variant="outline" size="sm" onClick={exportMarkdown}>
            Export Markdown
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyMarkdown()}>
            Copy
          </Button>
          <Button type="button" size="sm" disabled={!canGenerate} onClick={() => void generate()}>
            Regenerate
          </Button>
        </div>
      ) : null}
    </div>
  );
}
