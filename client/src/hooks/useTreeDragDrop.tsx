import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { flattenTree, type TodoNode } from "../lib/treeUtils";
import type { DropPreview } from "../lib/moveUtils";
import { dropPreviewEquals, resolveDropPreview } from "../lib/moveUtils";
import { DragOverlayRow } from "../components/DragOverlayRow";

const ACTIVATION = { delay: 50, tolerance: 6 };

type Options = {
  tree: TodoNode[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onMove: (dragId: string, preview: DropPreview) => Promise<void>;
  onExpandParent: (parentId: string) => void;
  findNode: (id: string) => TodoNode | undefined;
};

export function useTreeDragDrop({
  tree,
  scrollContainerRef,
  onMove,
  onExpandParent,
  findNode,
}: Options) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const dropPreviewRef = useRef<DropPreview | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const activeIdRef = useRef<string | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const [dragRowHeight, setDragRowHeight] = useState(48);

  const flat = flattenTree(tree);

  useEffect(() => {
    dropPreviewRef.current = dropPreview;
  }, [dropPreview]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: ACTIVATION })
  );

  const reset = useCallback(() => {
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
    activeIdRef.current = null;
    setActiveId(null);
    setDropPreview(null);
  }, []);

  const updatePreview = useCallback(
    (dragId: string) => {
      const { x, y } = pointerRef.current;
      setDropPreview((prev) => {
        const next = resolveDropPreview(x, y, dragId, tree, flat);
        return dropPreviewEquals(prev, next) ? prev : next;
      });
    },
    [flat, tree]
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      activeIdRef.current = id;
      setActiveId(id);
      setDropPreview(null);

      const h = event.active.rect.current.initial?.height;
      if (h) setDragRowHeight(h);

      const activator = event.activatorEvent;
      if (activator instanceof MouseEvent) {
        pointerRef.current = { x: activator.clientX, y: activator.clientY };
      } else if (activator instanceof TouchEvent) {
        const touch = activator.touches[0] ?? activator.changedTouches[0];
        if (touch) pointerRef.current = { x: touch.clientX, y: touch.clientY };
      }

      const onPointerMove = (e: PointerEvent) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        const dragId = activeIdRef.current;
        if (dragId) updatePreview(dragId);
      };
      window.addEventListener("pointermove", onPointerMove);
      pointerCleanupRef.current = () => window.removeEventListener("pointermove", onPointerMove);
    },
    [updatePreview]
  );

  const onDragMove = useCallback(
    (event: DragMoveEvent) => {
      updatePreview(String(event.active.id));
    },
    [updatePreview]
  );

  const onDragEnd = useCallback(
    async (_event: DragEndEvent) => {
      const dragId = String(_event.active.id);
      const { x, y } = pointerRef.current;
      const preview = resolveDropPreview(x, y, dragId, tree, flat);
      reset();
      if (!preview) return;
      if (preview.kind === "nest") onExpandParent(preview.targetId);
      await onMove(dragId, preview);
    },
    [flat, onExpandParent, onMove, reset, tree]
  );

  const onDragCancel = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!activeId || !scrollEl) return;

    const onScroll = () => updatePreview(activeId);
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [activeId, scrollContainerRef, updatePreview]);

  const activeNode = activeId ? findNode(activeId) : undefined;

  return {
    activeId,
    activeNode,
    dropPreview,
    dragRowHeight,
    sensors,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
  };
}

type ProviderProps = {
  children: ReactNode;
  drag: ReturnType<typeof useTreeDragDrop>;
};

export function TodoDragProvider({ children, drag }: ProviderProps) {
  return (
    <DndContext
      sensors={drag.sensors}
      onDragStart={drag.onDragStart}
      onDragMove={drag.onDragMove}
      onDragEnd={drag.onDragEnd}
      onDragCancel={drag.onDragCancel}
      autoScroll={{
        threshold: { x: 0, y: 0.12 },
        acceleration: 8,
        interval: 8,
      }}
    >
      {children}
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {drag.activeNode ? <DragOverlayRow node={drag.activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
