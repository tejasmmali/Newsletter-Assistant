import { describe, expect, it } from "vitest";
import {
  acceptEdit,
  createDraftState,
  deriveWorkingDraft,
  revertAll,
  undoEdit,
} from "@/lib/draft-state";

describe("draft-state", () => {
  const original = "AAA BBB CCC DDD EEE";

  it("applies accepted edits from last to first using original offsets", () => {
    let state = createDraftState(original);
    state = acceptEdit(state, "i1", "XX", 4, 7);
    state = acceptEdit(state, "i2", "YY", 12, 15);
    expect(deriveWorkingDraft(state)).toBe("AAA XX CCC YY EEE");
  });

  it("rejects overlapping earlier accepts when a newer overlapping accept wins", () => {
    let state = createDraftState(original);
    state = acceptEdit(state, "early", "ONE", 4, 11);
    state = acceptEdit(state, "late", "TWO", 8, 15);
    const early = state.edits.find((edit) => edit.issue_id === "early");
    expect(early?.status).toBe("rejected");
    expect(deriveWorkingDraft(state)).toBe("AAA BBB TWO EEE");
  });

  it("supports undo and revert-all", () => {
    let state = createDraftState(original);
    state = acceptEdit(state, "i1", "XX", 4, 7);
    expect(deriveWorkingDraft(state)).toBe("AAA XX CCC DDD EEE");
    state = undoEdit(state, "i1");
    expect(deriveWorkingDraft(state)).toBe(original);
    state = acceptEdit(state, "i1", "XX", 4, 7);
    state = acceptEdit(state, "i2", "YY", 12, 15);
    state = revertAll(state);
    expect(deriveWorkingDraft(state)).toBe(original);
  });
});
