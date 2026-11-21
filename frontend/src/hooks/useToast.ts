"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Toast {
  text: string;
  error?: boolean;
}

const TOAST_DURATION_MS = 4500;

/** A single transient status message that auto-dismisses. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, notify, dismiss };
}
