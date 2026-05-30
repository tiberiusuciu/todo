export type PopoverPosition = { top: number; left: number };

export function computePopoverPosition(
  trigger: HTMLElement,
  popoverWidth: number,
  popoverHeight: number,
  gap = 4
): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const left = Math.min(
    Math.max(rect.right - popoverWidth, gap),
    window.innerWidth - popoverWidth - gap
  );

  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const openBelow = spaceBelow >= popoverHeight || spaceBelow >= spaceAbove;

  const top = openBelow
    ? rect.bottom + gap
    : Math.max(gap, rect.top - popoverHeight - gap);

  return { top, left };
}
