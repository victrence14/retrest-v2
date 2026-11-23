"use client";

import { createContext, useContext } from "react";

export interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

export interface ToastContextValue {
  toast: Toast | null;
  notify: (text: string, error?: boolean) => void;
  dismiss: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Shared notifications survive auth redirects and workspace navigation. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("Notifications require the application toast provider.");
  return context;
}
