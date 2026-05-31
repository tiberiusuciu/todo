import type { TodoNode } from "./api";

function sortSiblings(siblings: TodoNode[]): TodoNode[] {
  return [...siblings].sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)
  );
}

function isPendingNode(node: TodoNode): boolean {
  return !!node.emojiPending || node._id.startsWith("temp-");
}

export function getReorderUpdates(
  siblings: TodoNode[],
  id: string,
  direction: "up" | "down"
): { id: string; order: number }[] | null {
  const sorted = sortSiblings(siblings);
  if (sorted.some(isPendingNode)) return null;
  const idx = sorted.findIndex((s) => s._id === id);
  if (idx === -1) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return null;

  const reordered = [...sorted];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

  return reordered.map((s, order) => ({ id: s._id, order }));
}

export function getReorderUpdatesFromDrag(
  siblings: TodoNode[],
  dragId: string,
  targetId: string
): { id: string; order: number }[] | null {
  if (dragId === targetId) return null;

  const sorted = sortSiblings(siblings);
  const fromIdx = sorted.findIndex((s) => s._id === dragId);
  const toIdx = sorted.findIndex((s) => s._id === targetId);
  if (fromIdx === -1 || toIdx === -1) return null;

  const reordered = [...sorted];
  const [item] = reordered.splice(fromIdx, 1);
  reordered.splice(toIdx, 0, item);

  return reordered.map((s, order) => ({ id: s._id, order }));
}
