import { useLayoutEffect, useRef } from "react";

export function useExpandHeight(deps: unknown[], open = true) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const applyHeight = () => {
      outer.style.height = open ? `${inner.scrollHeight}px` : "0px";
    };

    if (!readyRef.current) {
      outer.style.transition = "none";
      applyHeight();
      requestAnimationFrame(() => {
        outer.style.transition = "";
        readyRef.current = true;
      });
    } else {
      applyHeight();
    }

    const ro = new ResizeObserver(applyHeight);
    ro.observe(inner);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps]);

  return { outerRef, innerRef };
}
