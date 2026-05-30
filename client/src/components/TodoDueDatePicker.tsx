import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { computePopoverPosition } from "../lib/popoverPosition";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../lib/formatDueDate";

const POPOVER_W = 220;
const POPOVER_EST_H = 148;
const GAP = 4;

type Position = { top: number; left: number };

type Props = {
  dueAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onSave: (dueAt: string | null) => void;
};

export function TodoDueDatePicker({
  dueAt,
  open,
  onOpenChange,
  anchorRef,
  disabled,
  scrollContainerRef,
  onSave,
}: Props) {
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const local = toDatetimeLocalValue(dueAt);
    const [date, time] = local.split("T");
    setDateValue(date ?? "");
    setTimeValue(time ?? "12:00");
  }, [open, dueAt]);

  const updatePosition = () => {
    const el = anchorRef.current;
    if (!el) return;
    const height = containerRef.current?.offsetHeight ?? POPOVER_EST_H;
    setPosition(computePopoverPosition(el, POPOVER_W, height, GAP));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    requestAnimationFrame(updatePosition);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const scrollEl = scrollContainerRef?.current;
    const onScrollOrResize = () => updatePosition();

    scrollEl?.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      scrollEl?.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, scrollContainerRef]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, anchorRef]);

  if (disabled) return null;

  const popover =
    open &&
    createPortal(
      <div
        ref={containerRef}
        className="todo-due-date-popover fixed z-50 w-[220px] rounded-md bg-zinc-900 p-3 shadow-lg ring-1 ring-zinc-700"
        style={{ top: position.top, left: position.left }}
        role="dialog"
        aria-label="Due date"
      >
        <div className="flex flex-col gap-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="todo-datetime-input w-full rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none ring-1 ring-zinc-600"
          />
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="todo-datetime-input w-full rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none ring-1 ring-zinc-600"
          />
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              const iso = fromDatetimeLocalValue(`${dateValue}T${timeValue}`);
              if (iso) onSave(iso);
              onOpenChange(false);
            }}
          >
            Save
          </button>
          {dueAt && (
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-950/60"
              onClick={() => {
                onSave(null);
                onOpenChange(false);
              }}
            >
              Remove due date
            </button>
          )}
        </div>
      </div>,
      document.body
    );

  return popover;
}
