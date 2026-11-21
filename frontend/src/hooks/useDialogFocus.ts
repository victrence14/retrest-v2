"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";

/**
 * Modal accessibility while mounted: locks page scroll, focuses the first control,
 * traps Tab inside the dialog, closes on Escape, and restores focus on unmount.
 */
export function useDialogFocus(dialog: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return escape.current();
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dialog]);
}
