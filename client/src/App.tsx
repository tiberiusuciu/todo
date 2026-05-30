import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthPage } from "./components/AuthPage";
import { Toast } from "./components/Toast";
import { TodoTree } from "./components/TodoTree";
import { useAuth } from "./context/AuthContext";
import { useCollapsedState } from "./hooks/useCollapsed";
import { useShowCompleted } from "./hooks/useShowCompleted";
import { useToast } from "./hooks/useToast";
import { useTodos } from "./hooks/useTodos";
import { useTodoSync } from "./hooks/useTodoSync";
import { TodoDragProvider, useTreeDragDrop } from "./hooks/useTreeDragDrop";
import type { DropPreview } from "./lib/moveUtils";
import { countCompleted, filterCompleted, buildDirectChildProgressMap, type TodoNode } from "./lib/treeUtils";

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const { message, showToast, dismissToast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [scrollToTodoId, setScrollToTodoId] = useState<string | null>(null);
  const { tree, loading, error, create, update, remove, moveSibling, moveTodo, syncRemote } =
    useTodos(showToast, user?.id, setScrollToTodoId);

  useTodoSync({
    userId: user?.id,
    onSync: syncRemote,
    onRemoteChange: () => showToast("Updated from another device"),
  });
  const { isCollapsed, toggle } = useCollapsedState();
  const { showCompleted, toggle: toggleShowCompleted } = useShowCompleted();

  const findNode = useCallback((nodes: TodoNode[], id: string): TodoNode | undefined => {
    for (const n of nodes) {
      if (n._id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return undefined;
  }, []);

  const handleExpandParent = useCallback(
    (parentId: string) => {
      if (isCollapsed(parentId)) toggle(parentId);
    },
    [isCollapsed, toggle]
  );

  const handleMove = useCallback(
    (dragId: string, preview: DropPreview) => moveTodo(dragId, preview),
    [moveTodo]
  );

  const drag = useTreeDragDrop({
    tree,
    scrollContainerRef: listRef,
    onMove: handleMove,
    onExpandParent: handleExpandParent,
    findNode: (id) => findNode(tree, id),
  });

  const visibleTree = useMemo(
    () => (showCompleted ? tree : filterCompleted(tree)),
    [tree, showCompleted]
  );
  const completedCount = useMemo(() => countCompleted(tree), [tree]);
  const childProgressMap = useMemo(() => buildDirectChildProgressMap(tree), [tree]);

  const handleAddRoot = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle("");
    const saved = await create({ title: trimmed });
    if (!saved) setNewTitle(trimmed);
  };

  const handleUpdate = async (
    id: string,
    data: { title?: string; notes?: string; emoji?: string; completed?: boolean }
  ) => {
    await update(id, data);
  };

  const handleCreateChild = async (parentId: string, title: string) => {
    if (isCollapsed(parentId)) toggle(parentId);
    const saved = await create({ title, parentId });
    return saved !== null;
  };

  const handleDelete = async (id: string, hasChildren: boolean) => {
    if (hasChildren && !window.confirm("Delete this task and all sub-tasks?")) return;
    await remove(id);
  };

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center text-zinc-500">Loading...</div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 py-6 sm:py-10">
      <header className="mb-6 flex shrink-0 items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium text-zinc-100">Todos</h1>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={toggleShowCompleted}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              {showCompleted ? "Hide done" : `Show done (${completedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <form onSubmit={handleAddRoot} className="mb-4 flex shrink-0 gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="min-w-0 flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-zinc-100 px-4 py-3 text-base font-medium text-zinc-900 hover:bg-white"
        >
          Add
        </button>
      </form>

      <div
        ref={listRef}
        className="todo-scroll min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {loading && <p className="text-zinc-500">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          <TodoDragProvider drag={drag}>
            <TodoTree
              nodes={visibleTree}
              scrollContainerRef={listRef}
              scrollToTodoId={scrollToTodoId}
              onScrolledToTodo={() => setScrollToTodoId(null)}
              childProgressMap={childProgressMap}
              activeId={drag.activeId}
              dropPreview={drag.dropPreview}
              dragRowHeight={drag.dragRowHeight}
              onUpdate={handleUpdate}
              onCreate={handleCreateChild}
              onDelete={handleDelete}
              onMoveSibling={moveSibling}
              isCollapsed={isCollapsed}
              toggleCollapsed={toggle}
            />
          </TodoDragProvider>
        )}
      </div>

      <Toast message={message} onDismiss={dismissToast} />
    </div>
  );
}
