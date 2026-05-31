import type { ReorderItem, Todo, UpdateTodoInput } from "./api";

export type PendingEdits = UpdateTodoInput & {
  reorder?: ReorderItem[];
};

export function isTempId(id: string): boolean {
  return id.startsWith("temp-");
}

export function mergePendingEdits(
  existing: PendingEdits | undefined,
  input: UpdateTodoInput
): PendingEdits {
  return { ...existing, ...input };
}

export function applyLocalTodoToSaved(local: Todo, saved: Todo): Todo {
  return {
    ...saved,
    title: local.title,
    notes: local.notes,
    parentId: local.parentId,
    order: local.order,
    completed: local.completed,
    emojiPending: undefined,
  };
}

export function buildPostCreatePatch(merged: Todo, saved: Todo): UpdateTodoInput | null {
  const patch: UpdateTodoInput = {};
  if (merged.title !== saved.title) patch.title = merged.title;
  if (merged.notes !== saved.notes) patch.notes = merged.notes;
  if (merged.completed !== saved.completed) patch.completed = merged.completed;
  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export function remapReorderItems(
  items: ReorderItem[],
  tempId: string,
  realId: string
): ReorderItem[] {
  return items.map((item) => (item.id === tempId ? { ...item, id: realId } : item));
}

export function needsMoveSync(merged: Todo, saved: Todo): boolean {
  return merged.parentId !== saved.parentId || merged.order !== saved.order;
}
