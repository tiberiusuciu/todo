import { type RefObject } from "react";
import type { DirectChildProgress, TodoNode } from "../lib/treeUtils";
import { TodoSiblingList } from "./TodoSiblingList";

type Props = {
  nodes: TodoNode[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  childProgressMap: Map<string, DirectChildProgress>;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean }) => Promise<void>;
  onCreate: (parentId: string, title: string) => Promise<boolean>;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  onMoveSibling: (siblings: TodoNode[], id: string, direction: "up" | "down") => Promise<void>;
  onReorderByDrag: (siblings: TodoNode[], dragId: string, targetId: string) => Promise<void>;
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
};

export function TodoTree({
  nodes,
  scrollContainerRef,
  scrollToTodoId,
  onScrolledToTodo,
  childProgressMap,
  onUpdate,
  onCreate,
  onDelete,
  onMoveSibling,
  onReorderByDrag,
  isCollapsed,
  toggleCollapsed,
}: Props) {
  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-zinc-500 text-base">No tasks yet. Add one above.</p>
    );
  }

  return (
    <TodoSiblingList
      siblings={nodes}
      depth={0}
      className="space-y-1"
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
  );
}
