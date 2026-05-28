import { useCallback, useRef } from "react";

type Options = {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  disabled?: boolean;
};

export function useLongPress({ onLongPress, onClick, delay = 250, disabled = false }: Options) {
  const timerRef = useRef<number>();
  const longPressTriggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    if (disabled) return;
    longPressTriggeredRef.current = false;
    clear();
    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress();
    }, delay);
  }, [clear, delay, disabled, onLongPress]);

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: handleClick,
  };
}
