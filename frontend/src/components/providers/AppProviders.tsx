"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>;
}
