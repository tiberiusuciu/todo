import { type RefObject } from "react";
import type { DirectChildProgress, TodoNode } from "../lib/treeUtils";
import type { DropPreview } from "../lib/moveUtils";
import { TodoSiblingList } from "./TodoSiblingList";

type Props = {
  nodes: TodoNode[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToTodoId: string | null;
  onScrolledToTodo: () => void;
  childProgressMap: Map<string, DirectChildProgress>;
  activeId: string | null;
  dropPreview: DropPreview | null;
  dragRowHeight: number;
  onUpdate: (id: string, data: { title?: string; notes?: string; emoji?: string; completed?: boolean; dueAt?: string | null }) => Promise<void>;
  onCreate: (parentId: string, title: string) => Promise<boolean>;
  onDelete: (id: string, hasChildren: boolean) => Promise<void>;
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
};

export function TodoTree({
  nodes,
  scrollContainerRef,
  scrollToTodoId,
  onScrolledToTodo,
  childProgressMap,
  activeId,
  dropPreview,
  dragRowHeight,
  onUpdate,
  onCreate,
  onDelete,
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
      listParentId={null}
      depth={0}
      className="space-y-1"
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
      isCollapsed={isCollapsed}
      toggleCollapsed={toggleCollapsed}
    />
  );
}
