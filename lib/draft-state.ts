import { z } from "zod";

export const EditStatusSchema = z.enum(["accepted", "rejected", "pending"]);
export type EditStatus = z.infer<typeof EditStatusSchema>;

export const DraftEditSchema = z.object({
  issue_id: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  replacement: z.string(),
  status: EditStatusSchema,
});
export type DraftEdit = z.infer<typeof DraftEditSchema>;

export const DraftStateSchema = z.object({
  original: z.string(),
  edits: z.array(DraftEditSchema),
});
export type DraftState = z.infer<typeof DraftStateSchema>;

export function createDraftState(original: string): DraftState {
  return { original, edits: [] };
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Apply accepted edits against ORIGINAL offsets, last→first by start.
 * Overlapping accepted edits: keep the one that appears later in the edits
 * array (most recently accepted); earlier overlapping ones are skipped.
 */
export function deriveWorkingDraft(state: DraftState): string {
  const accepted = state.edits.filter((edit) => edit.status === "accepted");
  if (accepted.length === 0) return state.original;

  const kept: DraftEdit[] = [];
  for (let i = accepted.length - 1; i >= 0; i -= 1) {
    const edit = accepted[i]!;
    const overlaps = kept.some((keptEdit) =>
      rangesOverlap(keptEdit.start, keptEdit.end, edit.start, edit.end)
    );
    if (!overlaps) kept.push(edit);
  }

  const ordered = [...kept].sort((a, b) => b.start - a.start);
  let text = state.original;
  for (const edit of ordered) {
    text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  }
  return text;
}

export function acceptEdit(
  state: DraftState,
  issueId: string,
  replacement: string,
  start: number,
  end: number
): DraftState {
  const edits = state.edits
    .filter((edit) => edit.issue_id !== issueId)
    .map((edit) => {
      if (
        edit.status === "accepted" &&
        rangesOverlap(edit.start, edit.end, start, end)
      ) {
        return { ...edit, status: "rejected" as const };
      }
      return edit;
    });
  edits.push({
    issue_id: issueId,
    start,
    end,
    replacement,
    status: "accepted",
  });
  return { original: state.original, edits };
}

export function rejectEdit(
  state: DraftState,
  issueId: string,
  start = 0,
  end = 0
): DraftState {
  const existing = state.edits.find((edit) => edit.issue_id === issueId);
  const edits = state.edits.filter((edit) => edit.issue_id !== issueId);
  edits.push({
    issue_id: issueId,
    start: existing?.start ?? start,
    end: existing?.end ?? end,
    replacement: existing?.replacement ?? "",
    status: "rejected",
  });
  return { original: state.original, edits };
}

export function undoEdit(state: DraftState, issueId: string): DraftState {
  return {
    original: state.original,
    edits: state.edits.filter((edit) => edit.issue_id !== issueId),
  };
}

export function revertAll(state: DraftState): DraftState {
  return { original: state.original, edits: [] };
}
