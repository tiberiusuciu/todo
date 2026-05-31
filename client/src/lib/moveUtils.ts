import type { ReorderItem, Todo } from "./api";
import { isDescendant, type TodoNode } from "./treeUtils";

export type DropPreview =
  | { kind: "insert"; parentId: string | null; beforeId: string | null }
  | { kind: "nest"; targetId: string };

export type MoveResult = {
  parentId: string | null;
  order: number;
  sourceReorder: ReorderItem[];
  targetReorder: ReorderItem[];
};

function sortByOrder(a: Todo, b: Todo) {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

function getSiblings(flat: Todo[], parentId: string | null): Todo[] {
  return flat.filter((t) => t.parentId === parentId).sort(sortByOrder);
}

export function isPendingTodo(flat: Todo[], id: string): boolean {
  if (id.startsWith("temp-")) return true;
  const todo = flat.find((t) => t._id === id);
  return !!todo?.emojiPending;
}

export function isReorderBlocked(flat: Todo[], dragId: string, preview: DropPreview): boolean {
  if (!flat.find((t) => t._id === dragId)) return true;

  if (preview.kind === "nest") {
    if (isPendingTodo(flat, preview.targetId)) return true;
  } else if (preview.beforeId !== null && isPendingTodo(flat, preview.beforeId)) {
    return true;
  }

  return false;
}

function insertPreview(parentId: string | null, beforeId: string | null): DropPreview {
  return { kind: "insert", parentId, beforeId };
}

function insertAfter(
  flat: Todo[],
  parentId: string | null,
  afterId: string
): DropPreview | null {
  const siblings = getSiblings(flat, parentId);
  const afterIndex = siblings.findIndex((t) => t._id === afterId);
  if (afterIndex === -1) return null;
  const beforeId = afterIndex + 1 < siblings.length ? siblings[afterIndex + 1]._id : null;
  return insertPreview(parentId, beforeId);
}

export function isNoOpPreview(flat: Todo[], dragId: string, preview: DropPreview): boolean {
  const dragged = flat.find((t) => t._id === dragId);
  if (!dragged) return true;

  if (preview.kind === "nest") {
    return dragged.parentId === preview.targetId;
  }

  if (dragged.parentId !== preview.parentId) return false;

  const siblings = getSiblings(flat, preview.parentId);
  const dragIndex = siblings.findIndex((t) => t._id === dragId);
  if (dragIndex === -1) return false;

  if (preview.beforeId === null) {
    return dragIndex === siblings.length - 1;
  }

  if (preview.beforeId === dragId) return true;

  const beforeIndex = siblings.findIndex((t) => t._id === preview.beforeId);
  if (beforeIndex === -1) return false;

  return beforeIndex === dragIndex + 1;
}

export function computeMove(flat: Todo[], dragId: string, preview: DropPreview): MoveResult | null {
  if (isNoOpPreview(flat, dragId, preview)) return null;
  if (isReorderBlocked(flat, dragId, preview)) return null;

  const dragged = flat.find((t) => t._id === dragId);
  if (!dragged) return null;

  if (preview.kind === "nest") {
    if (preview.targetId === dragId) return null;

    const oldParentId = dragged.parentId;
    const existingChildren = getSiblings(flat, preview.targetId).filter((t) => t._id !== dragId);
    const targetSiblings = [...existingChildren, { ...dragged, parentId: preview.targetId }];
    const targetReorder = targetSiblings.map((t, i) => ({ id: t._id, order: i }));
    const order = targetReorder.find((r) => r.id === dragId)!.order;

    const sourceReorder =
      oldParentId !== preview.targetId
        ? getSiblings(flat, oldParentId)
            .filter((t) => t._id !== dragId)
            .map((t, i) => ({ id: t._id, order: i }))
        : [];

    return { parentId: preview.targetId, order, sourceReorder, targetReorder };
  }

  const { parentId, beforeId } = preview;
  const oldParentId = dragged.parentId;
  const targetSiblings = getSiblings(flat, parentId).filter((t) => t._id !== dragId);

  let insertIndex: number;
  if (beforeId === null) {
    insertIndex = targetSiblings.length;
  } else {
    insertIndex = targetSiblings.findIndex((t) => t._id === beforeId);
    if (insertIndex === -1) return null;
  }

  targetSiblings.splice(insertIndex, 0, { ...dragged, parentId });
  const targetReorder = targetSiblings.map((t, i) => ({ id: t._id, order: i }));
  const order = targetReorder.find((r) => r.id === dragId)!.order;

  const sourceReorder =
    oldParentId !== parentId
      ? getSiblings(flat, oldParentId)
          .filter((t) => t._id !== dragId)
          .map((t, i) => ({ id: t._id, order: i }))
      : targetReorder;

  return { parentId, order, sourceReorder, targetReorder };
}

export function applyMoveToFlat(flat: Todo[], dragId: string, move: MoveResult): Todo[] {
  const orderMap = new Map<string, number>();
  for (const item of [...move.targetReorder, ...move.sourceReorder]) {
    orderMap.set(item.id, item.order);
  }

  return flat.map((t) => {
    if (t._id === dragId) {
      return { ...t, parentId: move.parentId, order: move.order };
    }
    if (orderMap.has(t._id)) {
      return { ...t, order: orderMap.get(t._id)! };
    }
    return t;
  });
}

export function insertGapIndex(
  sorted: { _id: string }[],
  dropPreview: DropPreview | null,
  listParentId: string | null
): number | null {
  if (dropPreview?.kind !== "insert" || dropPreview.parentId !== listParentId) return null;
  if (dropPreview.beforeId === null) return sorted.length;
  const idx = sorted.findIndex((n) => n._id === dropPreview.beforeId);
  return idx >= 0 ? idx : null;
}

const INSERT_TOP = 0.22;
const INSERT_BOTTOM = 0.78;
const LIST_END_PAD = 12;

function findRowAt(clientX: number, clientY: number, dragId: string): HTMLElement | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const row = el.closest<HTMLElement>("[data-todo-row]");
    if (
      row &&
      row.getAttribute("data-todo-row") !== dragId &&
      row.getAttribute("data-todo-pending") !== "true"
    ) {
      return row;
    }
  }
  return null;
}

function findSiblingListAt(clientX: number, clientY: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const list = el.closest<HTMLElement>("[data-todo-sibling-list]");
    if (list) return list;
  }
  return null;
}

function rowMeta(row: HTMLElement) {
  const targetId = row.getAttribute("data-todo-row");
  const parentAttr = row.getAttribute("data-todo-parent");
  const parentId = parentAttr === "root" ? null : parentAttr;
  return { targetId, parentId };
}

function acceptPreview(
  flat: Todo[],
  dragId: string,
  candidate: DropPreview
): DropPreview | null {
  if (isNoOpPreview(flat, dragId, candidate)) return null;
  if (isReorderBlocked(flat, dragId, candidate)) return null;
  return candidate;
}

function previewFromRow(
  row: HTMLElement,
  clientY: number,
  flat: Todo[],
  dragId: string
): DropPreview | null {
  const { targetId, parentId } = rowMeta(row);
  if (!targetId) return null;

  const rect = row.getBoundingClientRect();
  const relY = (clientY - rect.top) / Math.max(rect.height, 1);

  let candidate: DropPreview;
  if (relY < INSERT_TOP) {
    candidate = insertPreview(parentId, targetId);
  } else if (relY > INSERT_BOTTOM) {
    candidate = insertAfter(flat, parentId, targetId) ?? insertPreview(parentId, null);
  } else {
    candidate = { kind: "nest", targetId };
  }

  return acceptPreview(flat, dragId, candidate);
}

function previewFromList(
  list: HTMLElement,
  clientX: number,
  clientY: number,
  flat: Todo[],
  dragId: string
): DropPreview | null {
  const parentAttr = list.getAttribute("data-todo-list-parent");
  const parentId = parentAttr === "root" ? null : parentAttr;
  const rows = [...list.querySelectorAll<HTMLElement>("[data-todo-row]")].filter(
    (row) =>
      row.getAttribute("data-todo-row") !== dragId &&
      row.getAttribute("data-todo-pending") !== "true"
  );

  if (rows.length === 0) {
    return acceptPreview(flat, dragId, insertPreview(parentId, null));
  }

  let nearest: { row: HTMLElement; dist: number } | null = null;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (clientX < rect.left - 32 || clientX > rect.right + 32) continue;
    const dist =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    if (!nearest || dist < nearest.dist) nearest = { row, dist };
  }

  if (!nearest || nearest.dist > 20) {
    const lastRow = rows[rows.length - 1];
    const lastRect = lastRow.getBoundingClientRect();
    if (clientY >= lastRect.bottom - LIST_END_PAD) {
      return acceptPreview(flat, dragId, insertPreview(parentId, null));
    }
    return null;
  }

  const rect = nearest.row.getBoundingClientRect();
  const { targetId, parentId: rowParentId } = rowMeta(nearest.row);
  if (!targetId) return null;

  if (clientY < rect.top) {
    return acceptPreview(flat, dragId, insertPreview(rowParentId, targetId));
  }
  if (clientY > rect.bottom) {
    const candidate = insertAfter(flat, rowParentId, targetId);
    if (!candidate) return null;
    return acceptPreview(flat, dragId, candidate);
  }

  return previewFromRow(nearest.row, clientY, flat, dragId);
}

function previewKey(p: DropPreview): string {
  return p.kind === "nest"
    ? `nest:${p.targetId}`
    : `insert:${p.parentId ?? "root"}:${p.beforeId ?? "end"}`;
}

export function resolveDropPreview(
  clientX: number,
  clientY: number,
  dragId: string,
  tree: TodoNode[],
  flat: Todo[]
): DropPreview | null {
  const row = findRowAt(clientX, clientY, dragId);

  if (row) {
    const targetId = row.getAttribute("data-todo-row");
    if (!targetId || isDescendant(tree, dragId, targetId)) {
      return null;
    }
    return previewFromRow(row, clientY, flat, dragId);
  }

  const list = findSiblingListAt(clientX, clientY);
  if (list) return previewFromList(list, clientX, clientY, flat, dragId);

  return null;
}

export function dropPreviewEquals(a: DropPreview | null, b: DropPreview | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return previewKey(a) === previewKey(b);
}
