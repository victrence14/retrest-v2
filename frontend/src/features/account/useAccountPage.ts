"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, isAbort } from "@/lib/api/client";
import { accountPage, type Filters } from "./api";

/** Keyset lists retain their filters and invalidate stale reads after mutations. */
export function useAccountPage<T extends { id: string }>(path: string, filters: Filters, onError: (error: unknown) => void) {
  const [rows, setRows] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const scope = JSON.stringify(filters);
  const load = useCallback(async (more = false, next?: string | null) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const version = ++generation.current;
    setLoading(true); setError("");
    try {
      const result = await accountPage<T>(path, { ...JSON.parse(scope), ...(more && next ? { cursor: next } : {}) }, controller.signal);
      if (version !== generation.current || controller.signal.aborted) return;
      setRows(previous => more ? [...new Map([...previous, ...result.data].map(row => [row.id, row])).values()] : result.data);
      setCursor(result.next_cursor);
    } catch (failure) {
      if (!isAbort(failure) && version === generation.current) { setError(errorMessage(failure)); onError(failure); }
    } finally { if (version === generation.current) setLoading(false); }
  }, [path, scope, onError]);
  useEffect(() => { setRows([]); setCursor(null); void load(); return () => { ++generation.current; active.current?.abort(); }; }, [load]);
  return { rows, cursor, loading, error, refresh: () => load(), more: () => load(true, cursor) };
}
