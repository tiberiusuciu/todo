import { useState, type RefObject } from "react";
import type { TodoNode } from "../lib/treeUtils";
import { TodoItem } from "./TodoItem";

type Props = {
  siblings: TodoNode[];
  depth: number;
  className?: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean }) => Promise<void>;
  onCreate: (parentId: string, title: string) => Promise<boolean>;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  onMoveSibling: (siblings: TodoNode[], id: string, direction: "up" | "down") => Promise<void>;
  onReorderByDrag: (siblings: TodoNode[], dragId: string, targetId: string) => Promise<void>;
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
  depth,
  className,
  onMoveSibling,
  onReorderByDrag,
  ...rest
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const sorted = sortSiblings(siblings);

  const handleDrop = async (targetId: string) => {
    if (dragId && dragId !== targetId) {
      await onReorderByDrag(sorted, dragId, targetId);
    }
    setDragId(null);
    setDropTargetId(null);
  };

  return (
    <ul className={className}>
      {sorted.map((node, index) => (
        <TodoItem
          key={node._id}
          node={node}
          depth={depth}
          siblings={sorted}
          siblingIndex={index}
          isDragging={dragId === node._id}
          isDropTarget={dropTargetId === node._id && dragId !== node._id}
          onDragStart={() => setDragId(node._id)}
          onDragEnd={() => {
            setDragId(null);
            setDropTargetId(null);
          }}
          onDragEnter={() => dragId && setDropTargetId(node._id)}
          onDrop={() => handleDrop(node._id)}
          onMoveUp={() => onMoveSibling(sorted, node._id, "up")}
          onMoveDown={() => onMoveSibling(sorted, node._id, "down")}
          onMoveSibling={onMoveSibling}
          onReorderByDrag={onReorderByDrag}
          {...rest}
        />
      ))}
    </ul>
  );
}
