"use client";

import { useCallback, useState } from "react";

/** Copies text, reports the outcome through `notify`, and flags `copied` for two seconds. */
export function useClipboard(notify: (text: string, error?: boolean) => void) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify("Copied to clipboard");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        notify("Clipboard unavailable. Select and copy the text manually.", true);
      }
    },
    [notify],
  );
  return { copy, copied };
}
