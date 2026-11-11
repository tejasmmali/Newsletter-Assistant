"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { diffWords } from "diff";
import { toast } from "sonner";
import { onCommand } from "@/components/commands";
import { analyzeDraft, type Issue, type IssueType } from "@/lib/analyzer";
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
import { computeMetrics, METRIC_HELP, type DraftMetrics } from "@/lib/metrics";
import type { RewriteResult } from "@/lib/schemas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Tab = "issues" | "compare" | "metrics";

const angleListeners = new Set<() => void>();

function subscribeAngle(listener: () => void) {
  angleListeners.add(listener);
  return () => angleListeners.delete(listener);
}

function readAngle() {
  return sessionStorage.getItem("twai-angle");
}

function clearStoredAngle() {
  sessionStorage.removeItem("twai-angle");
  angleListeners.forEach((listener) => listener());
}

const TYPE_LABEL: Record<IssueType, string> = {
  long_sentence: "Long sentence",
  passive_voice: "Passive",
  filler: "Filler",
  repetition: "Repetition",
  dense_paragraph: "Dense paragraph",
  jargon: "Jargon",
};

function statusFor(state: DraftState, id: string) {
  return state.edits.find((edit) => edit.issue_id === id)?.status;
}

function HighlightedDraft({
  text,
  issues,
  activeId,
  onPick,
}: {
  text: string;
  issues: Issue[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const marks = issues
    .filter((issue) => text.slice(issue.start, issue.end) === issue.original)
    .sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((issue, index) => {
    if (issue.start < cursor) return;
    if (issue.start > cursor) nodes.push(text.slice(cursor, issue.start));
    nodes.push(
      <mark
        key={`${issue.id}-${index}`}
        id={`issue-mark-${issue.id}`}
        data-issue={issue.id}
        className={`mark-${issue.type} ${activeId === issue.id ? "mark-active" : ""}`}
        onClick={() => onPick(issue.id)}
      >
        {text.slice(issue.start, issue.end)}
      </mark>
    );
    cursor = issue.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <div className="font-serif text-lg leading-8 whitespace-pre-wrap">{nodes}</div>;
}

function Metric({
  label,
  help,
  before,
  after,
}: {
  label: string;
  help: string;
  before: string;
  after: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="font-mono text-xs">
          {label} {before} → {after}
        </span>
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  );
}

function formatMetric(metrics: DraftMetrics) {
  return {
    words: String(metrics.wordCount),
    sentences: String(metrics.sentenceCount),
    avg: String(metrics.avgSentenceLength),
    flesch: String(metrics.fleschReadingEase),
    minutes: String(metrics.readingTimeMin),
  };
}

export function WriteWorkspace() {
  const [draftText, setDraftText] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [state, setState] = useState<DraftState>(createDraftState(""));
  const [tab, setTab] = useState<Tab>("issues");
  const [notice, setNotice] = useState<string | null>(null);
  const [rewrites, setRewrites] = useState<Record<string, RewriteResult>>({});
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmLowRisk, setConfirmLowRisk] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const angle = useSyncExternalStore(subscribeAngle, readAngle, () => null);
  const listRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => (analyzed ? analyzeDraft(analyzed) : []), [analyzed]);
  const working = analyzed ? deriveWorkingDraft(state) : draftText;
  const before = computeMetrics(analyzed || draftText);
  const after = computeMetrics(working);
  const beforeFmt = formatMetric(before);
  const afterFmt = formatMetric(after);
  const visible = issues.filter((issue) => typeFilter === "all" || issue.type === typeFilter);
  const ruleSuggestionCount = issues.filter((issue) => issue.suggestion !== undefined).length;

  useEffect(() => onCommand("load-example", loadExample), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
      if (!analyzed || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (!["j", "k", "a", "r", "u"].includes(key)) return;
      const list = visible.length > 0 ? visible : issues;
      if (list.length === 0) return;
      event.preventDefault();
      const index = Math.max(0, list.findIndex((issue) => issue.id === activeId));
      if (key === "j" || key === "k") {
        const next = list[(index + (key === "j" ? 1 : list.length - 1)) % list.length];
        if (next) focusIssue(next.id);
        return;
      }
      const current = list.find((issue) => issue.id === activeId) ?? list[0];
      if (!current) return;
      if (key === "a") {
        const suggestion = replacementFor(current);
        if (suggestion) setState((prev) => acceptEdit(prev, current.id, suggestion, current.start, current.end));
      } else if (key === "r") {
        setState((prev) => rejectEdit(prev, current.id, current.start, current.end));
      } else if (key === "u" && statusFor(state, current.id)) {
        setState((prev) => undoEdit(prev, current.id));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function loadExample() {
    setDraftText(EXAMPLE_DRAFT);
    setAnalyzed("");
    setState(createDraftState(EXAMPLE_DRAFT));
    setRewrites({});
    setNotice(null);
    setActiveId(null);
    toast("Example draft loaded.");
  }

  function analyze() {
    setAnalyzed(draftText);
    setState(createDraftState(draftText));
    setRewrites({});
    setNotice(null);
    setTab("issues");
    setActiveId(null);
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

  function focusIssue(id: string) {
    setActiveId(id);
    document.getElementById(`issue-mark-${id}`)?.scrollIntoView({ block: "center" });
    document.getElementById(`issue-card-${id}`)?.scrollIntoView({ block: "nearest" });
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
        toast.error(message);
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
      const message = serverNotice ?? `Received ${list.length} rewrite(s).`;
      setNotice(message);
      toast(message);
    } catch (err) {
      const message =
        err instanceof Error
          ? `${err.message} Manual accept and reject still work.`
          : "AI rewrites failed. Manual accept and reject still work.";
      setNotice(message);
      toast.error(message);
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
    const message = count === 0 ? "No low-risk rule suggestions to accept." : `Accepted ${count} low-risk suggestion(s).`;
    setNotice(message);
    toast(message);
  }

  function copyDraft() {
    void navigator.clipboard.writeText(working).then(
      () => toast("Draft copied."),
      () => toast.error("Could not copy.")
    );
  }

  function downloadDraft() {
    const blob = new Blob([working], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "draft.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function issueCards(list: Issue[]) {
    return list.map((issue) => {
      const status = statusFor(state, issue.id);
      const suggestion = replacementFor(issue);
      const ai = rewrites[issue.id];
      const kind = ai && !ai.guard_rejected && ai.rewritten !== issue.original ? "AI" : issue.suggestion !== undefined ? "Rule" : null;
      return (
        <article
          key={issue.id}
          id={`issue-card-${issue.id}`}
          className={`space-y-2 border p-3 text-sm ${activeId === issue.id ? "border-foreground" : "border-border"}`}
          onClick={() => focusIssue(issue.id)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{TYPE_LABEL[issue.type]}</Badge>
            <span
              role="img"
              className={`size-1.5 rounded-full ${issue.severity === "high" ? "bg-foreground" : issue.severity === "medium" ? "bg-foreground/60" : "bg-foreground/30"}`}
              aria-label={`${issue.severity} severity`}
            />
            {kind ? (
              <span className="font-mono text-[10px] tracking-wide uppercase text-muted-foreground">{kind}</span>
            ) : null}
            {status ? <span className="font-mono text-[10px] uppercase">{status}</span> : null}
          </div>
          <p className="font-mono text-xs whitespace-pre-wrap">{issue.original}</p>
          <p className="text-muted-foreground">Why: {issue.explanation}</p>
          <p>
            {ai?.label ?? (issue.suggestion !== undefined ? "Rule suggestion" : "No suggestion yet. Use Get AI rewrites.")}
          </p>
          {suggestion ? (
            <p>
              <span className="text-muted-foreground line-through">{issue.original}</span>
              <span className="mt-1 block text-verified">{suggestion}</span>
            </p>
          ) : null}
          {ai?.guard_rejected ? <p className="text-warning">rewrite rejected by safety check</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!suggestion}
              aria-label="Accept"
              onClick={(event) => {
                event.stopPropagation();
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
              aria-label="Reject"
              onClick={(event) => {
                event.stopPropagation();
                setState(rejectEdit(state, issue.id, issue.start, issue.end));
              }}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!status}
              aria-label="Undo"
              onClick={(event) => {
                event.stopPropagation();
                setState(undoEdit(state, issue.id));
              }}
            >
              Undo
            </Button>
          </div>
        </article>
      );
    });
  }

  const counts = issues.reduce<Record<string, number>>((map, issue) => {
    map[issue.type] = (map[issue.type] ?? 0) + 1;
    return map;
  }, {});

  const issuePane = (
    <div className="space-y-3" ref={listRef}>
      <p className="font-mono text-[10px] tracking-widest uppercase">Issues</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="border border-border px-2 py-1 font-mono text-[10px] uppercase" onClick={() => setTypeFilter("all")}>
          All {issues.length}
        </button>
        {(Object.keys(TYPE_LABEL) as IssueType[]).map((type) =>
          counts[type] ? (
            <button
              key={type}
              type="button"
              className="border border-border px-2 py-1 font-mono text-[10px] uppercase"
              onClick={() => setTypeFilter(type)}
            >
              {TYPE_LABEL[type]} {counts[type]}
            </button>
          ) : null
        )}
      </div>
      <p className="text-xs text-muted-foreground">Keys j/k move, a accept, r reject, u undo.</p>
      <ScrollArea className="md:h-[70vh]">
        <div className="space-y-3 pr-2">{issueCards(visible)}</div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Write</p>
        <h1 className="font-serif text-4xl tracking-tight">Writing Assistant</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Deterministic issues first. AI rewrites are optional and guarded.
        </p>
      </header>

      {angle ? (
        <Alert>
          <AlertTitle>Angle from research</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{angle}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const next = `${angle}\n\n${draftText}`.trim();
                onDraftChange(next === draftText ? next : `${angle}\n\n${draftText}`);
                if (!analyzed) setDraftText(`${angle}\n\n${draftText}`.trim());
                clearStoredAngle();
              }}
            >
              Insert angle
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={loadExample}>
          Load example draft
        </Button>
        <Button type="button" onClick={analyze} disabled={!draftText.trim()}>
          Analyze
        </Button>
        <Button type="button" variant="outline" onClick={analyze} disabled={!draftText.trim()}>
          Re-check
        </Button>
        <Button type="button" variant="outline" onClick={copyDraft} disabled={!working.trim()}>
          Copy
        </Button>
        <Button type="button" variant="outline" onClick={downloadDraft} disabled={!working.trim()}>
          Download
        </Button>
      </div>

      {!draftText.trim() ? (
        <div className="border border-dashed border-border px-4 py-12 text-center">
          <p className="font-serif text-2xl">Nothing on the desk.</p>
          <Button type="button" className="mt-4" onClick={loadExample}>
            Load example draft
          </Button>
        </div>
      ) : null}

      {draftText.trim() ? (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="border border-border">
            <div className="relative">
              {analyzed ? (
                <div className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-4" aria-hidden>
                  <HighlightedDraft text={analyzed} issues={issues} activeId={activeId} onPick={focusIssue} />
                </div>
              ) : null}
              <TextareaAutosize
                aria-label="Draft"
                minRows={12}
                value={draftText}
                onChange={(event) => onDraftChange(event.target.value)}
                className={`relative z-10 w-full resize-none bg-transparent px-4 py-4 font-serif text-lg leading-8 outline-none ${analyzed ? "text-transparent caret-foreground" : "text-foreground"}`}
              />
            </div>
            {analyzed ? (
              <div className="border-t border-border px-4 py-3">
                <p className="mb-2 font-mono text-[10px] tracking-widest uppercase">Legend</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(Object.keys(TYPE_LABEL) as IssueType[]).map((type) => (
                    <span key={type} className={`mark-${type} px-1`}>
                      {TYPE_LABEL[type]}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="hidden md:block">{analyzed ? issuePane : <p className="text-sm text-muted-foreground">Analyze to list issues.</p>}</div>
        </div>
      ) : null}

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

      {analyzed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">Found {issues.length} issues.</p>
          <Button type="button" size="sm" variant="outline" disabled={rewriteBusy || issues.length === 0} onClick={() => void getRewrites()}>
            {rewriteBusy ? "Requesting…" : "Get AI rewrites"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmLowRisk(true)}>
            Accept all low-risk
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRevert(true)}>
            Revert all
          </Button>
        </div>
      ) : null}

      <Tabs value={tab === "issues" ? "editor" : tab} onValueChange={(value) => setTab(value === "editor" ? "issues" : (value as Tab))}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>
          <Button type="button" className="md:hidden" variant="outline" onClick={() => setSheetOpen(true)} disabled={!analyzed}>
            Issue list
          </Button>
        </div>

        <TabsContent value="editor">
          {analyzed ? null : <p className="text-sm text-muted-foreground">Analyze a draft to list issues.</p>}
        </TabsContent>

        <TabsContent value="compare" className="space-y-2 font-serif text-lg leading-8">
          {analyzed ? (
            <>
              <p className="font-sans text-sm text-muted-foreground">Original vs working draft after accepted suggestions.</p>
              <p className="whitespace-pre-wrap">
                {diffWords(analyzed, working).map((part, index) => (
                  <span
                    key={index}
                    className={part.added ? "bg-verified/15" : part.removed ? "text-destructive line-through" : undefined}
                  >
                    {part.value}
                  </span>
                ))}
              </p>
            </>
          ) : (
            <p className="font-sans text-sm text-muted-foreground">Analyze a draft before comparing.</p>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-2 border border-border p-3">
          <div className="flex flex-wrap gap-4">
            <Metric label="words" help={METRIC_HELP.wordCount} before={beforeFmt.words} after={afterFmt.words} />
            <Metric label="sentences" help={METRIC_HELP.sentenceCount} before={beforeFmt.sentences} after={afterFmt.sentences} />
            <Metric label="avg" help={METRIC_HELP.avgSentenceLength} before={beforeFmt.avg} after={afterFmt.avg} />
            <Metric label="Flesch" help={METRIC_HELP.fleschReadingEase} before={beforeFmt.flesch} after={afterFmt.flesch} />
            <Metric label="min" help={METRIC_HELP.readingTimeMin} before={beforeFmt.minutes} after={afterFmt.minutes} />
          </div>
          <p className="text-sm text-muted-foreground">{METRIC_HELP.fleschReadingEase}</p>
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="Issues">{issuePane}</SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmLowRisk}
        onOpenChange={setConfirmLowRisk}
        title="Accept low-risk suggestions?"
        description="This accepts filler and repetition edits that already have a rule suggestion. Nothing else changes."
        confirmLabel="Accept"
        onConfirm={acceptAllLowRisk}
      />
      <AlertDialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title="Revert all edits?"
        description="Accepted and rejected marks are cleared. The original analyzed draft comes back."
        confirmLabel="Revert all"
        onConfirm={() => {
          setState(revertAll(state));
          setNotice("Reverted all edits.");
          toast("Reverted all edits.");
        }}
      />
    </div>
  );
}
