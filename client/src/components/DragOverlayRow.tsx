import type { TodoNode } from "../lib/treeUtils";

type Props = {
  node: TodoNode;
};

export function DragOverlayRow({ node }: Props) {
  return (
    <div className="todo-drag-overlay flex items-center gap-2 rounded-lg bg-zinc-900 px-2 py-1.5 shadow-xl ring-1 ring-zinc-700">
      <span className="text-base">{node.emoji || "📋"}</span>
      <span className="truncate text-base text-zinc-100">{node.title}</span>
    </div>
  );
}
