"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dashboard } from "@retrest/shared";
import { ensureSession, errorMessage } from "@/lib/api/client";
import { fetchWorkspace } from "@/features/workspace/api";

/** How often the dashboard re-reads server state (live activity, pool contributions). */
export const POLL_INTERVAL_MS = 3000;

type MutationResult = Dashboard | { state: Dashboard };
const stateOf = (value: MutationResult): Dashboard => ("state" in value ? value.state : value);

/**
 * Owns the workspace snapshot: polls the server, and runs one mutation at a time.
 * Each mutation returns the confirmed server state, which replaces local state.
 */
export function useWorkspaceState(initial: Dashboard, notify: (text: string, error?: boolean) => void) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => setData(initial), [initial]);

  useEffect(() => {
    const refresh = () => {
      if (busyRef.current) return;
      ensureSession()
        .then(() => fetchWorkspace())
        .then((value) => {
          if (!busyRef.current) setData(value);
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  /** Runs `request` unless another mutation is in flight. Resolves null on failure. */
  const mutate = useCallback(
    async <T extends MutationResult>(request: () => Promise<T>, message?: string): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setFormError("");
      try {
        await ensureSession();
        const value = await request();
        setData(stateOf(value));
        if (message) notify(message);
        return value;
      } catch (error) {
        const text = error instanceof Error ? errorMessage(error) : "Unable to save changes";
        notify(text, true);
        setFormError(text);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [notify],
  );

  return { data, setData, busy, isBusy: () => busyRef.current, mutate, formError, setFormError };
}
