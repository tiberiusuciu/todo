import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useDraggable } from "@dnd-kit/core";
import type { DirectChildProgress, TodoNode } from "../lib/treeUtils";
import { hasChildren } from "../lib/treeUtils";
import type { DropPreview } from "../lib/moveUtils";
import { useLongPress } from "../hooks/useLongPress";
import { useExpandHeight } from "../hooks/useExpandHeight";
import { TodoSiblingList } from "./TodoSiblingList";
import { EmojiPickerPopover } from "./EmojiPickerPopover";

type Props = {
  node: TodoNode;
  listParentId: string | null;
  depth: number;
  siblings: TodoNode[];
  siblingIndex: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  childProgressMap: Map<string, DirectChildProgress>;
  activeId: string | null;
  dropPreview: DropPreview | null;
  dragRowHeight: number;
  showInsertGhost: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean }) => Promise<void>;
  onCreate: (parentId: string, title: string) => Promise<boolean>;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  onMoveSibling: (siblings: TodoNode[], id: string, direction: "up" | "down") => Promise<void>;
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
};

function DragHandleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2" r="0.85" />
      <circle cx="7.5" cy="2" r="0.85" />
      <circle cx="2.5" cy="5" r="0.85" />
      <circle cx="7.5" cy="5" r="0.85" />
      <circle cx="2.5" cy="8" r="0.85" />
      <circle cx="7.5" cy="8" r="0.85" />
    </svg>
  );
}

export function TodoItem({
  node,
  listParentId,
  depth,
  siblings,
  siblingIndex,
  scrollContainerRef,
  scrollToTodoId,
  onScrolledToTodo,
  childProgressMap,
  activeId,
  dropPreview,
  dragRowHeight,
  showInsertGhost,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onCreate,
  onDelete,
  onMoveSibling,
  isCollapsed,
  toggleCollapsed,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [notes, setNotes] = useState(node.notes);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const itemRef = useRef<HTMLLIElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const childRef = useRef<HTMLInputElement>(null);

  const dragDisabled =
    siblings.some((s) => s.emojiPending) ||
    !!node.emojiPending ||
    editingTitle ||
    editingNotes ||
    addingChild;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: node._id,
    data: { node, parentId: listParentId, depth },
    disabled: dragDisabled,
  });

  const childCount = node.children.length;
  const collapsed = isCollapsed(node._id);
  const childrenOpen = childCount > 0 && !collapsed;
  const isPending = !!node.emojiPending;
  const listHasPending = siblings.some((s) => s.emojiPending);
  const canMoveUp = siblingIndex > 0 && !isPending && !listHasPending;
  const canMoveDown = siblingIndex < siblings.length - 1 && !isPending && !listHasPending;
  const childProgress = childProgressMap.get(node._id);
  const isBeingDragged = isDragging || activeId === node._id;
  const isNestTarget = dropPreview?.kind === "nest" && dropPreview.targetId === node._id;
  const parentKey = listParentId ?? "root";

  const togglePreview = useCallback(() => {
    setPreviewExpanded((prev) => !prev);
  }, []);

  const startEditTitle = useCallback(() => {
    if (isPending) return;
    setPreviewExpanded(false);
    setEditingTitle(true);
  }, [isPending]);

  const startEditNotes = useCallback(() => {
    if (isPending) return;
    setPreviewExpanded(false);
    setEditingNotes(true);
  }, [isPending]);

  const titlePress = useLongPress({
    onLongPress: togglePreview,
    onClick: startEditTitle,
    disabled: isPending || editingTitle || editingNotes,
  });

  const notesPress = useLongPress({
    onLongPress: togglePreview,
    onClick: startEditNotes,
    disabled: isPending || editingTitle || editingNotes || !node.notes,
  });

  const textLayout = previewExpanded
    ? "block w-full whitespace-normal break-words text-left"
    : "block w-full truncate whitespace-nowrap text-left";

  const { outerRef: previewOuterRef, innerRef: previewInnerRef } = useExpandHeight(
    [previewExpanded, node.title, node.notes, editingTitle, editingNotes, !!childProgress]
  );

  const { outerRef: childrenOuterRef, innerRef: childrenInnerRef } = useExpandHeight(
    [childCount, node._id],
    childrenOpen
  );

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

  useEffect(() => {
    if (!previewExpanded) return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (itemRef.current && !itemRef.current.contains(e.target as Node)) {
        setPreviewExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [previewExpanded]);

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

  return (
    <li
      ref={itemRef}
      className={`todo-dnd-item list-none ${isBeingDragged ? "opacity-40" : ""}`}
    >
      <div
        ref={setNodeRef}
        className="todo-row-target"
        data-todo-row={node._id}
        data-todo-parent={parentKey}
        data-todo-pending={isPending ? "true" : undefined}
      >
        <div
          className={`todo-drag-placeholder-inner${showInsertGhost ? " is-open" : ""}`}
          style={{
            height: showInsertGhost ? dragRowHeight : 0,
            marginBottom: showInsertGhost ? 4 : 0,
          }}
          aria-hidden
        />
        <div
          className={`todo-item group relative rounded-lg px-1 py-1 ${node.completed ? "opacity-60" : ""} ${addingChild || editingTitle || editingNotes ? "show-controls" : ""}`}
        >
          {isNestTarget && <div className="todo-nest-overlay" aria-hidden />}

          <div className="flex items-start gap-1 sm:gap-2">
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
            </div>

            <div
              className={`min-w-0 flex-1 ${
                childProgress
                  ? "pr-3 [@media(hover:hover)]:group-hover:pr-[7rem] [@media(hover:hover)]:group-focus-within:pr-[7rem]"
                  : "[@media(hover:hover)]:group-hover:pr-[5.5rem] [@media(hover:hover)]:group-focus-within:pr-[5.5rem]"
              }`}
            >
              {editingTitle || editingNotes ? (
                <>
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
                        disabled={isPending}
                        className={`min-w-0 flex-1 disabled:cursor-default ${
                          node.completed ? "line-through text-zinc-500" : "text-zinc-100"
                        } text-base`}
                        {...titlePress}
                      >
                        <span className={textLayout}>{node.title}</span>
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
                      disabled={isPending}
                      className="mt-0.5 block w-full min-w-0 text-left text-sm text-zinc-400 hover:text-zinc-300 disabled:cursor-default disabled:hover:text-zinc-400"
                      {...(node.notes ? notesPress : { onClick: startEditNotes })}
                    >
                      {node.notes ? (
                        <span className={textLayout}>{node.notes}</span>
                      ) : (
                        "Add notes..."
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div ref={previewOuterRef} className="todo-preview-expand">
                  <div ref={previewInnerRef}>
                    <div className="flex min-w-0 items-baseline gap-1">
                      <button
                        type="button"
                        disabled={isPending}
                        className={`min-w-0 flex-1 disabled:cursor-default ${
                          node.completed ? "line-through text-zinc-500" : "text-zinc-100"
                        } text-base`}
                        {...titlePress}
                      >
                        <span className={textLayout}>{node.title}</span>
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

                    <button
                      type="button"
                      disabled={isPending}
                      className="mt-0.5 block w-full min-w-0 text-left text-sm text-zinc-400 hover:text-zinc-300 disabled:cursor-default disabled:hover:text-zinc-400"
                      {...(node.notes ? notesPress : { onClick: startEditNotes })}
                    >
                      {node.notes ? (
                        <span className={textLayout}>{node.notes}</span>
                      ) : (
                        "Add notes..."
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`todo-item-actions flex shrink-0 items-center ${isPending ? "opacity-40" : ""}`}>
              <div
                className={`todo-item-controls rounded-md bg-zinc-950/95 px-0.5 ${childProgress ? "[@media(hover:none)]:mr-0.5" : ""} ${isPending ? "pointer-events-none" : ""}`}
              >
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

              <button
                type="button"
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                disabled={dragDisabled}
                className="todo-drag-handle"
                aria-label="Drag to reorder"
              >
                <DragHandleIcon />
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
      </div>

      {childCount > 0 && (
        <div
          ref={childrenOuterRef}
          className="todo-preview-expand"
          aria-hidden={!childrenOpen}
        >
          <div ref={childrenInnerRef} className={childrenOpen ? undefined : "pointer-events-none"}>
            <TodoSiblingList
              siblings={node.children}
              listParentId={node._id}
              depth={depth + 1}
              className="ml-4 border-l border-zinc-800 pl-2"
              scrollContainerRef={scrollContainerRef}
              scrollToTodoId={scrollToTodoId}
              onScrolledToTodo={onScrolledToTodo}
              childProgressMap={childProgressMap}
              activeId={activeId}
              dropPreview={dropPreview}
              dragRowHeight={dragRowHeight}
              onUpdate={onUpdate}
              onCreate={onCreate}
              onDelete={onDelete}
              onMoveSibling={onMoveSibling}
              isCollapsed={isCollapsed}
              toggleCollapsed={toggleCollapsed}
            />
          </div>
        </div>
      )}
    </li>
  );
}
