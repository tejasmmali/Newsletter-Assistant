"use client";

import { useMemo, useState, type ReactNode } from "react";
import { diffWords } from "diff";
import { analyzeDraft, type Issue } from "@/lib/analyzer";
import {
  acceptEdit,
  createDraftState,
  deriveWorkingDraft,
  rejectEdit,
  revertAll,
  undoEdit,
  type DraftState,
} from "@/lib/draft-state";
import { EXAMPLE_DRAFT } from "@/lib/example-draft";
import { computeMetrics, METRIC_HELP } from "@/lib/metrics";
import type { RewriteResult } from "@/lib/schemas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Tab = "issues" | "compare" | "metrics";

function statusFor(state: DraftState, id: string) {
  return state.edits.find((edit) => edit.issue_id === id)?.status;
}

function HighlightedDraft({ text, issues }: { text: string; issues: Issue[] }) {
  const marks = issues
    .filter((issue) => text.slice(issue.start, issue.end) === issue.original)
    .sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((issue, index) => {
    if (issue.start < cursor) return;
    if (issue.start > cursor) nodes.push(text.slice(cursor, issue.start));
    nodes.push(
      <mark key={`${issue.id}-${index}`} className="bg-amber-200/80" data-issue={issue.id}>
        {text.slice(issue.start, issue.end)}
      </mark>
    );
    cursor = issue.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <p className="whitespace-pre-wrap text-sm leading-6">{nodes}</p>;
}

export function WriteWorkspace() {
  const [draftText, setDraftText] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [state, setState] = useState<DraftState>(createDraftState(""));
  const [tab, setTab] = useState<Tab>("issues");
  const [notice, setNotice] = useState<string | null>(null);
  const [rewrites, setRewrites] = useState<Record<string, RewriteResult>>({});
  const [rewriteBusy, setRewriteBusy] = useState(false);

  const issues = useMemo(() => (analyzed ? analyzeDraft(analyzed) : []), [analyzed]);
  const working = analyzed ? deriveWorkingDraft(state) : draftText;
  const before = computeMetrics(analyzed || draftText);
  const after = computeMetrics(working);

  function loadExample() {
    setDraftText(EXAMPLE_DRAFT);
    setAnalyzed("");
    setState(createDraftState(EXAMPLE_DRAFT));
    setRewrites({});
    setNotice(null);
  }

  function analyze() {
    setAnalyzed(draftText);
    setState(createDraftState(draftText));
    setRewrites({});
    setNotice(issues.length ? null : null);
    setTab("issues");
  }

  function onDraftChange(next: string) {
    if (analyzed && next !== draftText) {
      const ok = window.confirm("Editing the draft clears accepted suggestions. Continue?");
      if (!ok) return;
      setAnalyzed("");
      setState(createDraftState(next));
      setRewrites({});
    }
    setDraftText(next);
  }

  function replacementFor(issue: Issue): string | null {
    const ai = rewrites[issue.id];
    if (ai && !ai.guard_rejected && ai.rewritten !== issue.original) return ai.rewritten;
    if (issue.suggestion !== undefined) return issue.suggestion;
    return null;
  }

  async function getRewrites() {
    const batch = issues.slice(0, 15);
    if (batch.length === 0) return;
    setRewriteBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: analyzed, issues: batch }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "AI rewrites failed. You can still accept rule-based suggestions and reject issues.";
        setNotice(message);
        return;
      }
      const list =
        body && typeof body === "object" && "rewrites" in body && Array.isArray(body.rewrites)
          ? (body.rewrites as RewriteResult[])
          : [];
      const next = { ...rewrites };
      for (const item of list) next[item.issue_id] = item;
      setRewrites(next);
      const serverNotice =
        body && typeof body === "object" && "notice" in body && typeof body.notice === "string"
          ? body.notice
          : null;
      setNotice(serverNotice ?? `Received ${list.length} rewrite(s).`);
    } catch (err) {
      setNotice(
        err instanceof Error
          ? `${err.message} Manual accept and reject still work.`
          : "AI rewrites failed. Manual accept and reject still work."
      );
    } finally {
      setRewriteBusy(false);
    }
  }

  function acceptAllLowRisk() {
    let next = state;
    let count = 0;
    for (const issue of issues) {
      if (issue.type !== "filler" && issue.type !== "repetition") continue;
      if (issue.suggestion === undefined) continue;
      if (statusFor(next, issue.id) === "accepted") continue;
      next = acceptEdit(next, issue.id, issue.suggestion, issue.start, issue.end);
      count += 1;
    }
    setState(next);
    setNotice(count === 0 ? "No low-risk rule suggestions to accept." : `Accepted ${count} low-risk suggestion(s).`);
  }

  const ruleSuggestionCount = issues.filter((issue) => issue.suggestion !== undefined).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Writing Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic issues first. AI rewrites are optional and guarded.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={loadExample}>
          Load example draft
        </Button>
        <Button type="button" onClick={analyze} disabled={!draftText.trim()}>
          Analyze
        </Button>
      </div>

      <Textarea
        aria-label="Draft"
        rows={12}
        value={draftText}
        onChange={(event) => onDraftChange(event.target.value)}
      />

      {analyzed ? (
        <p className="text-sm text-muted-foreground">
          Only filler phrases like “in order to” have a rule-based suggestion
          {ruleSuggestionCount === 1 ? " (one on this draft)" : ""}. Accepting several different
          edits needs Get AI rewrites. If that call fails, you can still accept the rule-based
          suggestion and reject any issue.
        </p>
      ) : null}

      {notice ? (
        <Alert>
          <AlertTitle>Status</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === "issues" ? "default" : "outline"} onClick={() => setTab("issues")}>
          Issues
        </Button>
        <Button type="button" variant={tab === "compare" ? "default" : "outline"} onClick={() => setTab("compare")}>
          Compare
        </Button>
        <Button type="button" variant={tab === "metrics" ? "default" : "outline"} onClick={() => setTab("metrics")}>
          Metrics
        </Button>
      </div>

      {tab === "issues" && analyzed ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">Found {issues.length} issues.</p>
            <Button type="button" size="sm" variant="outline" disabled={rewriteBusy || issues.length === 0} onClick={() => void getRewrites()}>
              {rewriteBusy ? "Requesting…" : "Get AI rewrites"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={acceptAllLowRisk}>
              Accept all low-risk
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setState(revertAll(state));
                setNotice("Reverted all edits.");
              }}
            >
              Revert all
            </Button>
          </div>
          <HighlightedDraft text={analyzed} issues={issues} />
          {issues.map((issue) => {
            const status = statusFor(state, issue.id);
            const suggestion = replacementFor(issue);
            const ai = rewrites[issue.id];
            return (
              <Card key={issue.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{issue.type}</Badge>
                    <Badge variant="secondary">{issue.severity}</Badge>
                    {status ? <Badge>{status}</Badge> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="whitespace-pre-wrap font-mono text-xs">{issue.original}</p>
                  <p>{issue.explanation}</p>
                  <p>
                    {ai?.label ?? (issue.suggestion !== undefined ? "Rule suggestion" : "No suggestion yet. Use Get AI rewrites.")}
                  </p>
                  {suggestion ? <p className="text-emerald-800">Suggestion: {suggestion}</p> : null}
                  {ai?.guard_rejected ? (
                    <p className="text-amber-800">rewrite rejected by safety check</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!suggestion}
                      onClick={() => {
                        if (!suggestion) return;
                        setState(acceptEdit(state, issue.id, suggestion, issue.start, issue.end));
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setState(rejectEdit(state, issue.id, issue.start, issue.end))}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!status}
                      onClick={() => setState(undoEdit(state, issue.id))}
                    >
                      Undo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "compare" && analyzed ? (
        <div className="space-y-2 text-sm leading-6">
          <p className="text-muted-foreground">Original vs working draft after accepted suggestions.</p>
          <p className="whitespace-pre-wrap">
            {diffWords(analyzed, working).map((part, index) => (
              <span
                key={index}
                className={part.added ? "bg-emerald-200" : part.removed ? "bg-rose-200 line-through" : undefined}
              >
                {part.value}
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {tab === "metrics" ? (
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="font-medium">Before</p>
            <p>{before.wordCount} words · {before.sentenceCount} sentences</p>
            <p>Flesch {before.fleschReadingEase}</p>
          </div>
          <div>
            <p className="font-medium">After</p>
            <p>{after.wordCount} words · {after.sentenceCount} sentences</p>
            <p>Flesch {after.fleschReadingEase}</p>
          </div>
          <p className="sm:col-span-2 text-muted-foreground">{METRIC_HELP.fleschReadingEase}</p>
        </div>
      ) : null}
    </div>
  );
}
