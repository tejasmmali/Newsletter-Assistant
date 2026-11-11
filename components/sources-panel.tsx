"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { BriefPanel } from "@/components/brief-panel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Source } from "@/lib/schemas";

function readError(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as { message?: unknown; error?: unknown };
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim() && record.error !== "invalid_url") {
      return record.error;
    }
  }
  return fallback;
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function wordCount(text: string | null) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function statusLabel(status: Source["status"]) {
  if (status === "ok") return "Ready";
  if (status === "needs_manual_text") return "Needs text";
  return "Failed";
}

function statusClass(status: Source["status"]) {
  if (status === "ok") return "text-verified border-verified";
  if (status === "needs_manual_text") return "text-warning border-warning";
  return "text-destructive border-destructive";
}

export function SourcesPanel({ origin }: { origin: string }) {
  const [urls, setUrls] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualText, setManualText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Source | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sources", { signal: AbortSignal.timeout(15_000) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(body, "Failed to load sources"));
      const list =
        body && typeof body === "object" && "sources" in body && Array.isArray(body.sources)
          ? (body.sources as Source[])
          : [];
      setSources(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const ready = useMemo(
    () => sources.filter((source) => source.status === "ok" && source.text).length,
    [sources]
  );

  async function ingestUrls(list: string[]) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: list }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(body, "Ingest failed"));
      await load();
      setUrls("");
      toast("Sources updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingest failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onPasteUrls(event: React.FormEvent) {
    event.preventDefault();
    const list = urls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError("Paste at least one URL (one per line).");
      return;
    }
    await ingestUrls(list);
  }

  async function onManual(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: manualUrl.trim(),
          title: manualTitle.trim() || undefined,
          text: manualText.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(body, "Manual ingest failed"));
      setManualUrl("");
      setManualTitle("");
      setManualText("");
      setManualOpen(false);
      await load();
      toast("Source saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Manual ingest failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveManual(source: Source) {
    const text = (drafts[source.id] ?? "").trim();
    if (!text) {
      setError("Paste article text before saving.");
      return;
    }
    setSavingId(source.id);
    setError(null);
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(body, "Failed to save text"));
      setDrafts((current) => {
        const next = { ...current };
        delete next[source.id];
        return next;
      });
      await load();
      toast("Article text saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save text";
      setError(message);
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function removeSource(source: Source) {
    setError(null);
    try {
      const response = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(body, "Could not delete source"));
      await load();
      toast("Source deleted.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete source";
      setError(message);
      toast.error(message);
    }
  }

  const bookmarklet = `javascript:(function(){var t=prompt("Ingest token");if(!t)return;fetch(${JSON.stringify(
    `${origin}/api/ingest`
  )},{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+t},body:JSON.stringify({url:location.href,title:document.title})}).then(function(r){alert(r.ok?"Saved":"Ingest failed ("+r.status+")");});})();`;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Research</p>
        <h1 className="font-serif text-4xl tracking-tight">Research Assistant</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Collect sources, generate a grounded brief, then pick an angle. Three ready sources are required.
        </p>
      </header>

      <section aria-labelledby="step-sources" className="space-y-4">
        <h2 id="step-sources" className="font-mono text-[10px] tracking-widest uppercase">
          01 Sources
        </h2>
        <form onSubmit={onPasteUrls} className="space-y-2 border border-border p-4">
          <Label htmlFor="source-urls">Paste URLs (one per line)</Label>
          <Textarea
            id="source-urls"
            rows={4}
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            placeholder="https://example.com/story"
          />
          <p className="text-xs text-muted-foreground">
            Failures (paywall, timeout, X/Twitter) get a paste box. Blocked URLs stay out of the list.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add sources"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualOpen((open) => !open)}>
              Add with pasted text
            </Button>
          </div>
        </form>

        {manualOpen ? (
          <form onSubmit={onManual} className="space-y-2 border border-border p-4">
            <Label htmlFor="manual-url">URL</Label>
            <Input id="manual-url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} />
            <Label htmlFor="manual-title">Title</Label>
            <Input id="manual-title" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} />
            <Label htmlFor="manual-text">Article text</Label>
            <Textarea id="manual-text" rows={5} value={manualText} onChange={(event) => setManualText(event.target.value)} />
            <Button type="submit" disabled={busy}>
              Save source
            </Button>
          </form>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger className="text-sm underline-offset-4 hover:underline">
            Bookmarklet
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 border border-border p-3 text-sm">
            <p className="text-muted-foreground">
              Copy this bookmark. When you click it on an article, it asks for the ingest token and saves the page URL. The token is not stored in the app.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(bookmarklet).then(
                  () => toast("Bookmarklet copied."),
                  () => toast.error("Could not copy.")
                );
              }}
            >
              <Copy className="mr-1 size-3.5" aria-hidden />
              Copy bookmarklet
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {error ? (
          <p role="alert" className="border border-destructive px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <p className="font-mono text-xs text-muted-foreground">
          {loading ? "Loading sources…" : `${ready} ready · ${sources.length} total`}
        </p>

        {loading ? (
          <div className="space-y-2" aria-hidden>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : sources.length === 0 ? (
          <p className="border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No sources yet. Paste three public article URLs to start.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {sources.map((source) => (
              <motion.li
                key={source.id}
                className="space-y-2 p-3"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClass(source.status)}>
                        {statusLabel(source.status)}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{domainOf(source.url)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {wordCount(source.text)} {wordCount(source.text) === 1 ? "word" : "words"}
                      </span>
                    </div>
                    <a href={source.url} className="mt-1 block text-sm underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                      {source.title || source.url}
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${source.title || domainOf(source.url)}`}
                    onClick={() => setPendingDelete(source)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                {source.error ? <p className="text-sm text-warning">{source.error}</p> : null}
                {source.status === "needs_manual_text" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`manual-${source.id}`}>Paste article text</Label>
                    <Textarea
                      id={`manual-${source.id}`}
                      rows={5}
                      placeholder="Paste the full article"
                      value={drafts[source.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [source.id]: event.target.value }))
                      }
                    />
                    <Button type="button" size="sm" disabled={savingId === source.id} onClick={() => void saveManual(source)}>
                      Save text
                    </Button>
                  </div>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <Separator />
      <BriefPanel readyCount={ready} />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this source?"
        description="The row is removed from the research list. This does not change the original article."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void removeSource(pendingDelete);
        }}
      />
    </div>
  );
}
