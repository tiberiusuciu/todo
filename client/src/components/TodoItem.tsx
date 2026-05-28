import { useState, useRef, useEffect, useLayoutEffect, type DragEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { DirectChildProgress, TodoNode } from "../lib/treeUtils";
import { hasChildren } from "../lib/treeUtils";
import { TodoSiblingList } from "./TodoSiblingList";
import { EmojiPickerPopover } from "./EmojiPickerPopover";

type Props = {
  node: TodoNode;
  depth: number;
  siblings: TodoNode[];
  siblingIndex: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  childProgressMap: Map<string, DirectChildProgress>;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean }) => Promise<void>;
  onCreate: (parentId: string, title: string) => Promise<boolean>;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  onMoveSibling: (siblings: TodoNode[], id: string, direction: "up" | "down") => Promise<void>;
  onReorderByDrag: (siblings: TodoNode[], dragId: string, targetId: string) => Promise<void>;
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
};

export function TodoItem({
  node,
  depth,
  siblings,
  siblingIndex,
  scrollContainerRef,
  scrollToTodoId,
  onScrolledToTodo,
  childProgressMap,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onCreate,
  onDelete,
  onMoveSibling,
  onReorderByDrag,
  isCollapsed,
  toggleCollapsed,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const itemRef = useRef<HTMLLIElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const childRef = useRef<HTMLInputElement>(null);

  const childCount = node.children.length;
  const collapsed = isCollapsed(node._id);
  const showChildren = childCount > 0 && !collapsed;
  const canMoveUp = siblingIndex > 0;
  const canMoveDown = siblingIndex < siblings.length - 1;
  const isPending = !!node.emojiPending;
  const childProgress = childProgressMap.get(node._id);

  useEffect(() => {
    setTitle(node.title);
    setNotes(node.notes);
  }, [node.title, node.notes]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingNotes) notesRef.current?.focus();
  }, [editingNotes]);

  useEffect(() => {
    if (addingChild) childRef.current?.focus();
  }, [addingChild]);

  useLayoutEffect(() => {
    if (scrollToTodoId !== node._id || !itemRef.current) return;
    itemRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    onScrolledToTodo();
  }, [scrollToTodoId, node._id, onScrolledToTodo]);

  const saveTitle = async () => {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(node.title);
      return;
    }
    if (trimmed !== node.title) await onUpdate(node._id, { title: trimmed });
  };

  const saveNotes = async () => {
    setEditingNotes(false);
    if (notes !== node.notes) await onUpdate(node._id, { notes });
  };

  const handleTitleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") saveTitle();
    if (e.key === "Escape") {
      setTitle(node.title);
      setEditingTitle(false);
    }
  };

  const handleNotesKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setNotes(node.notes);
      setEditingNotes(false);
    }
  };

  const submitChild = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = childTitle.trim();
    if (!trimmed) {
      setAddingChild(false);
      setChildTitle("");
      return;
    }
    const ok = await onCreate(node._id, trimmed);
    if (ok) {
      setChildTitle("");
      setAddingChild(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragEnter();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    onDrop();
  };

  return (
    <li
      ref={itemRef}
      className={`list-none ${isDragging ? "opacity-40" : ""} ${isDropTarget ? "rounded-lg ring-1 ring-zinc-600" : ""}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className={`todo-item group relative rounded-lg px-1 py-1 ${node.completed ? "opacity-60" : ""} ${addingChild || editingTitle || editingNotes ? "show-controls" : ""}`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => childCount > 0 && toggleCollapsed(node._id)}
            disabled={childCount === 0}
            className={`flex h-6 w-5 shrink-0 items-center justify-center rounded text-xs text-zinc-400 ${
              childCount > 0
                ? "hover:bg-zinc-800 hover:text-zinc-200"
                : "invisible pointer-events-none"
            }`}
            aria-label={childCount > 0 ? (collapsed ? "Expand" : "Collapse") : undefined}
            aria-hidden={childCount === 0}
          >
            {childCount > 0 ? (collapsed ? "▸" : "▾") : ""}
          </button>

          <input
            type="checkbox"
            checked={node.completed}
            disabled={isPending}
            onChange={(e) => onUpdate(node._id, { completed: e.target.checked })}
            className="todo-checkbox"
          />

          <EmojiPickerPopover
            emoji={node.emoji || "📋"}
            loading={isPending}
            scrollContainerRef={scrollContainerRef}
            onSelect={(emoji) => onUpdate(node._id, { emoji })}
          />

          <div
            className={`min-w-0 flex-1 ${
              childProgress
                ? "pr-3 [@media(hover:hover)]:group-hover:pr-[7rem] [@media(hover:hover)]:group-focus-within:pr-[7rem]"
                : "[@media(hover:hover)]:group-hover:pr-[5.5rem] [@media(hover:hover)]:group-focus-within:pr-[5.5rem]"
            }`}
          >
            {editingTitle ? (
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={handleTitleKey}
                className="w-full rounded bg-zinc-800 px-2 py-1 text-base text-zinc-100 outline-none ring-1 ring-zinc-600"
              />
            ) : (
              <div className="flex min-w-0 items-baseline gap-1">
                <button
                  type="button"
                  onClick={() => !isPending && setEditingTitle(true)}
                  disabled={isPending}
                  className={`min-w-0 flex-1 text-left text-base disabled:cursor-default ${
                    node.completed ? "line-through text-zinc-500" : "text-zinc-100"
                  }`}
                >
                  {node.title}
                </button>
                {childProgress && (
                  <span
                    className={`mr-1 shrink-0 text-[10px] tabular-nums ${
                      childProgress.done === childProgress.total
                        ? "text-zinc-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {childProgress.done}/{childProgress.total}
                  </span>
                )}
              </div>
            )}

            {editingNotes ? (
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                onKeyDown={handleNotesKey}
                rows={2}
                placeholder="Notes..."
                className="mt-1 w-full resize-y rounded bg-zinc-800 px-2 py-1 text-base text-zinc-300 outline-none ring-1 ring-zinc-600"
              />
            ) : (
              <button
                type="button"
                onClick={() => !isPending && setEditingNotes(true)}
                disabled={isPending}
                className="mt-0.5 block w-full text-left text-sm text-zinc-400 hover:text-zinc-300 disabled:cursor-default disabled:hover:text-zinc-400"
              >
                {node.notes || "Add notes..."}
              </button>
            )}
          </div>

          <div
            className={`todo-item-controls rounded-md bg-zinc-950/95 px-0.5 ${childProgress ? "[@media(hover:none)]:ml-1" : ""} ${isPending ? "pointer-events-none opacity-40" : ""}`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", node._id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-xs text-zinc-500 active:cursor-grabbing hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Drag to reorder"
            >
              ⠿
            </button>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="flex h-3.5 w-5 items-center justify-center rounded text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:invisible"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="flex h-3.5 w-5 items-center justify-center rounded text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:invisible"
                aria-label="Move down"
              >
                ↓
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAddingChild(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Add sub-task"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onDelete(node._id, hasChildren(node))}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-zinc-400 hover:bg-red-950 hover:text-red-400"
              aria-label="Delete"
            >
              ×
            </button>
          </div>
        </div>

        {addingChild && (
          <form onSubmit={submitChild} className="ml-10 mt-1.5 flex gap-2">
            <input
              ref={childRef}
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              placeholder="Sub-task title"
              className="min-w-0 flex-1 rounded bg-zinc-800 px-3 py-2 text-base text-zinc-100 outline-none ring-1 ring-zinc-600"
            />
            <button
              type="submit"
              className="rounded bg-zinc-700 px-3 py-2 text-base text-zinc-100 hover:bg-zinc-600"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingChild(false);
                setChildTitle("");
              }}
              className="rounded px-3 py-2 text-base text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {showChildren && (
        <TodoSiblingList
          siblings={node.children}
          depth={depth + 1}
          className="ml-4 border-l border-zinc-800 pl-2"
          scrollContainerRef={scrollContainerRef}
          scrollToTodoId={scrollToTodoId}
          onScrolledToTodo={onScrolledToTodo}
          childProgressMap={childProgressMap}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onDelete={onDelete}
          onMoveSibling={onMoveSibling}
          onReorderByDrag={onReorderByDrag}
          isCollapsed={isCollapsed}
          toggleCollapsed={toggleCollapsed}
        />
      )}
    </li>
  );
}
