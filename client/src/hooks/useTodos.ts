import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type CreateTodoInput, type ReorderItem, type Todo, type UpdateTodoInput } from "../lib/api";
import { mergeTodos, todosChanged } from "../lib/mergeTodos";
import { applyMoveToFlat, computeMove, type DropPreview, type MoveResult } from "../lib/moveUtils";
import {
  applyLocalTodoToSaved,
  buildPostCreatePatch,
  isTempId,
  mergePendingEdits,
  needsMoveSync,
  remapReorderItems,
  type PendingEdits,
} from "../lib/pendingEdits";
import { getReorderUpdatesFromDrag } from "../lib/reorderUtils";
import { buildTree, type TodoNode } from "../lib/treeUtils";

const CREATE_ERROR = "Couldn't create task. Try again.";
const MOVE_ERROR = "Couldn't move task. Try again.";

function buildOptimisticTodo(prev: Todo[], input: CreateTodoInput, tempId: string): Todo {
  const parentId = input.parentId ?? null;
  const siblings = prev.filter((t) => t.parentId === parentId);
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1;
  const now = new Date().toISOString();

  return {
    _id: tempId,
    title: input.title.trim(),
    notes: input.notes ?? "",
    emoji: "",
    emojiPending: true,
    completed: false,
    parentId,
    order: maxOrder + 1,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeReorderItems(move: MoveResult): ReorderItem[] {
  const seen = new Set<string>();
  const items: ReorderItem[] = [];
  for (const item of [...move.targetReorder, ...move.sourceReorder]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

export function useTodos(
  onCreateError?: (message: string, failedInput?: CreateTodoInput) => void,
  userId?: string,
  onOptimisticCreate?: (tempId: string) => void
) {
  const todosRef = useRef<Todo[]>([]);
  const [, setTodos] = useState<Todo[]>([]);
  const [tree, setTree] = useState<TodoNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingOpsRef = useRef(0);
  const pendingSyncRef = useRef(false);
  const pendingEditsRef = useRef<Map<string, PendingEdits>>(new Map());
  const abortedTempsRef = useRef<Set<string>>(new Set());

  const commitTodos = useCallback((next: Todo[]) => {
    todosRef.current = next;
    setTodos(next);
    setTree(buildTree(next));
  }, []);

  const applyTodos = useCallback(
    (data: Todo[]) => {
      commitTodos(data);
    },
    [commitTodos]
  );

  const refresh = useCallback(async () => {
    const data = await api.list();
    applyTodos(data);
  }, [applyTodos]);

  const syncRemote = useCallback(async (): Promise<boolean> => {
    if (pendingOpsRef.current > 0) {
      pendingSyncRef.current = true;
      return false;
    }
    try {
      const data = await api.list();
      const merged = mergeTodos(todosRef.current, data);
      const changed = todosChanged(todosRef.current, merged);
      if (changed) commitTodos(merged);
      return changed;
    } catch {
      return false;
    }
  }, [commitTodos]);

  const finishPendingOp = useCallback(() => {
    pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
    if (pendingOpsRef.current === 0 && pendingSyncRef.current) {
      pendingSyncRef.current = false;
      void syncRemote();
    }
  }, [syncRemote]);

  const withPending = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      pendingOpsRef.current++;
      try {
        return await fn();
      } finally {
        finishPendingOp();
      }
    },
    [finishPendingOp]
  );

  const flushPostCreate = useCallback(
    async (tempId: string, realId: string, merged: Todo, saved: Todo, pending?: PendingEdits) => {
      try {
        if (needsMoveSync(merged, saved)) {
          await api.update(realId, { parentId: merged.parentId, order: merged.order });
        }

        if (pending?.reorder?.length) {
          const items = remapReorderItems(pending.reorder, tempId, realId);
          await api.reorder(items);
        }

        const patch = buildPostCreatePatch(merged, saved);
        if (patch) {
          const updated = await api.update(realId, patch);
          commitTodos(
            todosRef.current.map((t) => (t._id === realId ? { ...t, ...updated } : t))
          );
        }
      } catch (e) {
        if (isConflictError(e)) await syncRemote();
      }
    },
    [commitTodos, syncRemote]
  );

  useEffect(() => {
    if (!userId) {
      todosRef.current = [];
      setTodos([]);
      setTree([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    refresh()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refresh, userId]);

  const create = useCallback(
    (input: CreateTodoInput): Todo => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const snapshot = todosRef.current;
      const optimistic = buildOptimisticTodo(snapshot, input, tempId);
      commitTodos([...snapshot, optimistic]);
      onOptimisticCreate?.(tempId);

      void withPending(async () => {
        try {
          const saved = await api.create(input);
          const pending = pendingEditsRef.current.get(tempId);
          pendingEditsRef.current.delete(tempId);

          const wasAborted = abortedTempsRef.current.delete(tempId);
          const local = todosRef.current.find((t) => t._id === tempId);

          if (wasAborted || !local) {
            try {
              await api.delete(saved._id);
            } catch {
              /* ignore */
            }
            return;
          }

          const merged = applyLocalTodoToSaved(local, saved);
          commitTodos(todosRef.current.map((t) => (t._id === tempId ? merged : t)));
          await flushPostCreate(tempId, saved._id, merged, saved, pending);
        } catch {
          pendingEditsRef.current.delete(tempId);
          abortedTempsRef.current.delete(tempId);
          commitTodos(todosRef.current.filter((t) => t._id !== tempId));
          onCreateError?.(CREATE_ERROR, input);
        }
      });

      return optimistic;
    },
    [commitTodos, flushPostCreate, onCreateError, onOptimisticCreate, withPending]
  );

  const update = useCallback(
    async (id: string, input: UpdateTodoInput) => {
      if (isTempId(id)) {
        const now = new Date().toISOString();
        commitTodos(
          todosRef.current.map((t) =>
            t._id === id ? { ...t, ...input, updatedAt: now } : t
          )
        );
        pendingEditsRef.current.set(
          id,
          mergePendingEdits(pendingEditsRef.current.get(id), input)
        );
        return todosRef.current.find((t) => t._id === id);
      }

      return withPending(async () => {
        try {
          const todo = await api.update(id, input);
          commitTodos(
            todosRef.current.map((t) => {
              if (t._id !== id) return t;
              return {
                ...t,
                ...todo,
                order: input.order !== undefined ? todo.order : t.order,
                parentId: input.parentId !== undefined ? todo.parentId : t.parentId,
              };
            })
          );
          return todo;
        } catch (e) {
          if (isConflictError(e)) await syncRemote();
          throw e;
        }
      });
    },
    [commitTodos, syncRemote, withPending]
  );

  const remove = useCallback(
    async (id: string) => {
      if (isTempId(id)) {
        abortedTempsRef.current.add(id);
        pendingEditsRef.current.delete(id);
        commitTodos(todosRef.current.filter((t) => t._id !== id));
        return;
      }

      await withPending(async () => {
        await api.delete(id);
        await syncRemote();
      });
    },
    [commitTodos, syncRemote, withPending]
  );

  const applyReorder = useCallback(
    (items: ReorderItem[]) => {
      const orderMap = new Map(items.map((i) => [i.id, i.order]));
      commitTodos(
        todosRef.current.map((t) =>
          orderMap.has(t._id) ? { ...t, order: orderMap.get(t._id)! } : t
        )
      );
    },
    [commitTodos]
  );

  const reorder = useCallback(
    async (items: ReorderItem[]) => {
      if (items.some((item) => isTempId(item.id))) {
        applyReorder(items);
        return;
      }

      await withPending(async () => {
        try {
          await api.reorder(items);
          applyReorder(items);
        } catch (e) {
          if (isConflictError(e)) await syncRemote();
          throw e;
        }
      });
    },
    [applyReorder, syncRemote, withPending]
  );

  const reorderByDrag = useCallback(
    async (siblings: TodoNode[], dragId: string, targetId: string) => {
      const items = getReorderUpdatesFromDrag(siblings, dragId, targetId);
      if (!items) return;
      await reorder(items);
    },
    [reorder]
  );

  const moveTodo = useCallback(
    async (dragId: string, preview: DropPreview) => {
      const snapshot = todosRef.current;
      const move = computeMove(snapshot, dragId, preview);
      if (!move) return;

      const optimistic = applyMoveToFlat(snapshot, dragId, move);
      commitTodos(optimistic);

      const items = mergeReorderItems(move);
      const draggedBefore = snapshot.find((t) => t._id === dragId);
      const parentChanged = draggedBefore?.parentId !== move.parentId;

      if (isTempId(dragId)) {
        pendingEditsRef.current.set(dragId, {
          ...mergePendingEdits(pendingEditsRef.current.get(dragId), {
            parentId: move.parentId,
            order: move.order,
          }),
          reorder: items,
        });
        return;
      }

      await withPending(async () => {
        try {
          if (parentChanged) {
            await api.update(dragId, { parentId: move.parentId, order: move.order });
          }
          if (items.length > 0) {
            await api.reorder(items);
          }
        } catch (e) {
          commitTodos(snapshot);
          if (isConflictError(e)) await syncRemote();
          onCreateError?.(MOVE_ERROR);
        }
      });
    },
    [commitTodos, onCreateError, syncRemote, withPending]
  );

  return {
    tree,
    loading,
    error,
    create,
    update,
    remove,
    reorderByDrag,
    moveTodo,
    refresh,
    syncRemote,
  };
}
