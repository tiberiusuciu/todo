import { describe, expect, it } from "vitest";
import type { Todo } from "./api";
import { isOptimisticTodo, mergeTodos } from "./mergeTodos";

function todo(partial: Partial<Todo> & Pick<Todo, "_id" | "title">): Todo {
  return {
    notes: "",
    emoji: "📋",
    completed: false,
    parentId: null,
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("mergeTodos", () => {
  it("keeps optimistic temp todos not yet on the server", () => {
    const local = [todo({ _id: "temp-1", title: "Pending", emojiPending: true })];
    const remote: Todo[] = [];

    const merged = mergeTodos(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]._id).toBe("temp-1");
    expect(isOptimisticTodo(merged[0])).toBe(true);
  });

  it("drops local todos deleted on the server", () => {
    const local = [todo({ _id: "a", title: "Gone locally" })];
    const remote: Todo[] = [];

    const merged = mergeTodos(local, remote);
    expect(merged).toHaveLength(0);
  });

  it("prefers newer updatedAt and server on tie", () => {
    const local = [todo({ _id: "a", title: "Local", updatedAt: "2024-01-02T00:00:00.000Z" })];
    const remote = [todo({ _id: "a", title: "Remote", updatedAt: "2024-01-01T00:00:00.000Z" })];

    expect(mergeTodos(local, remote)[0].title).toBe("Local");

    const staleLocal = [todo({ _id: "a", title: "Local", updatedAt: "2024-01-01T00:00:00.000Z" })];
    const newerRemote = [todo({ _id: "a", title: "Remote", updatedAt: "2024-01-02T00:00:00.000Z" })];

    expect(mergeTodos(staleLocal, newerRemote)[0].title).toBe("Remote");

    const tiedLocal = [todo({ _id: "a", title: "Local", updatedAt: "2024-01-02T00:00:00.000Z" })];
    const tiedRemote = [todo({ _id: "a", title: "Remote", updatedAt: "2024-01-02T00:00:00.000Z" })];

    expect(mergeTodos(tiedLocal, tiedRemote)[0].title).toBe("Remote");
  });
});
