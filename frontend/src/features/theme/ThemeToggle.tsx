"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Moon, Sun } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { errorMessage } from "@/lib/api/client";
import { useTheme } from "./ThemeProvider";
import type { ResolvedTheme } from "./theme";

export function ThemeToggle({ disabled = false, onChange }: {
  disabled?: boolean;
  onChange?: (theme: ResolvedTheme) => Promise<boolean>;
}) {
  const { preference, resolvedTheme, ready, setPreference } = useTheme();
  const { notify } = useToast();
  const [pending, setPending] = useState<ResolvedTheme | null>(null);
  const lock = useRef(false);

  async function select(next: ResolvedTheme) {
    if (disabled || lock.current || preference === next) return;
    lock.current = true;
    setPending(next);
    try {
      if (onChange && !await onChange(next)) return;
      setPreference(next);
      notify(`${next === "light" ? "Light" : "Dark"} mode enabled.`);
    } catch (error) { notify(errorMessage(error), true); }
    finally { lock.current = false; setPending(null); }
  }

  return <div className="theme-toggle" role="group" aria-label="Appearance">
    {(["light", "dark"] as const).map(theme => {
      const Icon = theme === "light" ? Sun : Moon;
      return <button key={theme} type="button" data-mode={theme}
        aria-label={`Use ${theme} mode`} aria-pressed={ready && resolvedTheme === theme}
        disabled={disabled || pending !== null} onClick={() => void select(theme)}>
        {pending === theme ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
        <span>{theme === "light" ? "Light" : "Dark"}</span>
      </button>;
    })}
  </div>;
}
