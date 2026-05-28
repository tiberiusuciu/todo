import { useCallback, useEffect, useState } from "react";
import { api, type CreateTodoInput, type ReorderItem, type Todo, type UpdateTodoInput } from "../lib/api";
import { getReorderUpdates, getReorderUpdatesFromDrag } from "../lib/reorderUtils";
import { buildTree, type TodoNode } from "../lib/treeUtils";

const CREATE_ERROR = "Couldn't create task. Try again.";

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
    createdAt: now,
    updatedAt: now,
  };
}

export function useTodos(
  onCreateError?: (message: string) => void,
  userId?: string,
  onOptimisticCreate?: (tempId: string) => void
) {
  const [, setTodos] = useState<Todo[]>([]);
  const [tree, setTree] = useState<TodoNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyTodos = useCallback((data: Todo[]) => {
    setTodos(data);
    setTree(buildTree(data));
  }, []);

  const refresh = useCallback(async () => {
    const data = await api.list();
    applyTodos(data);
  }, [applyTodos]);

  useEffect(() => {
    if (!userId) {
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

  const create = async (input: CreateTodoInput): Promise<Todo | null> => {
    const tempId = `temp-${crypto.randomUUID()}`;

    setTodos((prev) => {
      const optimistic = buildOptimisticTodo(prev, input, tempId);
      const next = [...prev, optimistic];
      setTree(buildTree(next));
      return next;
    });
    onOptimisticCreate?.(tempId);

    try {
      const saved = await api.create(input);
      setTodos((prev) => {
        const next = prev.map((t) => (t._id === tempId ? saved : t));
        setTree(buildTree(next));
        return next;
      });
      return saved;
    } catch {
      setTodos((prev) => {
        const next = prev.filter((t) => t._id !== tempId);
        setTree(buildTree(next));
        return next;
      });
      onCreateError?.(CREATE_ERROR);
      return null;
    }
  };

  const update = async (id: string, input: UpdateTodoInput) => {
    const todo = await api.update(id, input);
    setTodos((prev) => {
      const next = prev.map((t) => (t._id === id ? todo : t));
      setTree(buildTree(next));
      return next;
    });
    return todo;
  };

  const remove = async (id: string) => {
    await api.delete(id);
    await refresh();
  };

  const applyReorder = useCallback(
    (items: ReorderItem[]) => {
      const orderMap = new Map(items.map((i) => [i.id, i.order]));
      setTodos((prev) => {
        const next = prev.map((t) =>
          orderMap.has(t._id) ? { ...t, order: orderMap.get(t._id)! } : t
        );
        setTree(buildTree(next));
        return next;
      });
    },
    []
  );

  const reorder = async (items: ReorderItem[]) => {
    await api.reorder(items);
    applyReorder(items);
  };

  const moveSibling = async (siblings: TodoNode[], id: string, direction: "up" | "down") => {
    const items = getReorderUpdates(siblings, id, direction);
    if (!items) return;
    await reorder(items);
  };

  const reorderByDrag = async (siblings: TodoNode[], dragId: string, targetId: string) => {
    const items = getReorderUpdatesFromDrag(siblings, dragId, targetId);
    if (!items) return;
    await reorder(items);
  };

  return { tree, loading, error, create, update, remove, moveSibling, reorderByDrag, refresh };
}
