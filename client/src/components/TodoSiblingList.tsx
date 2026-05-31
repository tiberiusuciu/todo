import { type RefObject } from "react";
import type { DirectChildProgress, TodoNode } from "../lib/treeUtils";
import type { DropPreview } from "../lib/moveUtils";
import { insertGapIndex } from "../lib/moveUtils";
import { TodoItem } from "./TodoItem";

type Props = {
  siblings: TodoNode[];
  listParentId: string | null;
  depth: number;
  className?: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  childProgressMap: Map<string, DirectChildProgress>;
  activeId: string | null;
  dropPreview: DropPreview | null;
  dragRowHeight: number;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean; dueAt?: string | null }) => Promise<void>;
  onCreate: (parentId: string, title: string) => void;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
};

function sortSiblings(siblings: TodoNode[]) {
  return [...siblings].sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)
  );
}

export function TodoSiblingList({
  siblings,
  listParentId,
  depth,
  className,
  activeId,
  dropPreview,
  dragRowHeight,
  ...rest
}: Props) {
  const sorted = sortSiblings(siblings);
  const insertIndex = insertGapIndex(sorted, dropPreview, listParentId);

  const listParentKey = listParentId ?? "root";

  return (
    <ul
      className={`todo-sibling-list ${className ?? ""}`}
      data-todo-sibling-list
      data-todo-list-parent={listParentKey}
    >
      {sorted.map((node, index) => (
        <TodoItem
          key={node._id}
          node={node}
          listParentId={listParentId}
          depth={depth}
          siblings={sorted}
          activeId={activeId}
          dropPreview={dropPreview}
          dragRowHeight={dragRowHeight}
          showInsertGhost={insertIndex === index && node._id !== activeId}
          {...rest}
        />
      ))}
      <li className="todo-dnd-item list-none" aria-hidden>
        <div
          className={`todo-drag-placeholder-inner${insertIndex === sorted.length ? " is-open" : ""}`}
          style={{ height: insertIndex === sorted.length ? dragRowHeight : 0 }}
        />
      </li>
    </ul>
  );
}
