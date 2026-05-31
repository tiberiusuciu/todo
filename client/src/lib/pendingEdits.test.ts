import { describe, expect, it } from "vitest";
import {
  applyLocalTodoToSaved,
  buildPostCreatePatch,
  isTempId,
  mergePendingEdits,
  needsMoveSync,
  remapReorderItems,
} from "./pendingEdits";
import type { Todo } from "./api";

const saved: Todo = {
  _id: "real-1",
  title: "Original",
  notes: "",
  emoji: "📋",
  completed: false,
  parentId: null,
  order: 0,
  dueAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("pendingEdits", () => {
  it("detects temp ids", () => {
    expect(isTempId("temp-abc")).toBe(true);
    expect(isTempId("real-abc")).toBe(false);
  });

  it("merges pending edit fields", () => {
    expect(mergePendingEdits({ title: "A" }, { notes: "B" })).toEqual({
      title: "A",
      notes: "B",
    });
  });

  it("applies local state onto saved todo", () => {
    const local = { ...saved, _id: "temp-1", title: "Edited", notes: "N", order: 2, emojiPending: true };
    const merged = applyLocalTodoToSaved(local, saved);
    expect(merged.title).toBe("Edited");
    expect(merged.notes).toBe("N");
    expect(merged.order).toBe(2);
    expect(merged.emojiPending).toBeUndefined();
  });

  it("builds patch for changed title/notes", () => {
    const merged = { ...saved, title: "Edited", notes: "Notes" };
    expect(buildPostCreatePatch(merged, saved)).toEqual({
      title: "Edited",
      notes: "Notes",
    });
  });

  it("remaps temp id in reorder items", () => {
    expect(remapReorderItems([{ id: "temp-1", order: 1 }], "temp-1", "real-1")).toEqual([
      { id: "real-1", order: 1 },
    ]);
  });

  it("detects move sync need", () => {
    expect(needsMoveSync({ ...saved, order: 1 }, saved)).toBe(true);
    expect(needsMoveSync(saved, saved)).toBe(false);
  });
});
