"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefPanel } from "@/components/brief-panel";
import { SourceStatusBadge } from "@/components/source-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual ingest failed");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save text");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Research Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Collect sources → generate brief → pick an angle. Need at least 3 ready sources.
        </p>
      </div>

      <form onSubmit={onPasteUrls} className="space-y-2">
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
        <form onSubmit={onManual} className="space-y-2 rounded-lg border border-border p-3">
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

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {loading ? "Loading sources…" : `${ready} ready · ${sources.length} total`}
      </p>

      <ul className="space-y-3">
        {sources.map((source) => (
          <li key={source.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <SourceStatusBadge status={source.status} />
              <a href={source.url} className="text-sm underline" target="_blank" rel="noreferrer">
                {source.title || source.url}
              </a>
            </div>
            {source.error ? <p className="text-sm text-amber-800">{source.error}</p> : null}
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
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">Workspace origin {origin}</p>
      <BriefPanel readyCount={ready} />
    </div>
  );
}
