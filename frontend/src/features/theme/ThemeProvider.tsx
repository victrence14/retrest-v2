"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isThemePreference, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "./theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
  adoptAccountPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [ready, setReady] = useState(false);
  const explicitPreference = useRef(false);

  const apply = useCallback((next: ThemePreference, persist: boolean) => {
    const resolved = next === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : next;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = next;
    updatePreference(next);
    setResolvedTheme(resolved);
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* The current tab still follows the choice. */ }
    }
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    explicitPreference.current = true;
    apply(next, true);
  }, [apply]);

  const adoptAccountPreference = useCallback((next: ThemePreference) => {
    // An explicit browser choice also applies to the auth pages and takes priority.
    if (!explicitPreference.current) {
      explicitPreference.current = true;
      apply(next, true);
    }
  }, [apply]);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Storage is optional. */ }
    explicitPreference.current = isThemePreference(saved);
    const initial = document.documentElement.dataset.themePreference;
    apply(isThemePreference(initial) ? initial : "system", false);
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      explicitPreference.current = isThemePreference(event.newValue);
      apply(isThemePreference(event.newValue) ? event.newValue : "system", false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  useEffect(() => {
    if (!ready || preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system", false);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference, ready, apply]);

  return <ThemeContext.Provider value={{ preference, resolvedTheme, ready, setPreference, adoptAccountPreference }}>
    {children}
  </ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme controls require the application theme provider.");
  return context;
}
