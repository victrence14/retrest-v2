"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { ToastContext, type Toast } from "@/hooks/useToast";

function Notice({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.error ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.error, paused, dismiss]);
  return <div className="toast-notice" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <ToastMessage toast={toast} onDismiss={() => dismiss(toast.id)} />
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeDialog, setActiveDialog] = useState<HTMLElement | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((text: string, error = false) => {
    if (!text.trim()) return;
    const next = { id: ++sequence.current, text, error };
    setToasts(previous => [...previous.filter(toast => toast.text !== text || !!toast.error !== error), next].slice(-3));
  }, []);
  const dismissNotice = useCallback((id: number) => setToasts(previous => previous.filter(toast => toast.id !== id)), []);
  const dismiss = useCallback(() => setToasts([]), []);
  useEffect(() => {
    // Place notifications in the active dialog so native modal inertness and
    // keyboard focus traps still allow their dismiss button to be used.
    const syncDialog = () => setActiveDialog(Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]')).at(-1) ?? null);
    syncDialog();
    const observer = new MutationObserver(syncDialog);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal"] });
    return () => observer.disconnect();
  }, []);
  const viewport = <section className="toast-viewport" aria-label="Notifications">
    {toasts.map(toast => <Notice key={toast.id} toast={toast} dismiss={dismissNotice} />)}
  </section>;
  return <ToastContext.Provider value={{ toast: toasts.at(-1) ?? null, notify, dismiss }}>
    {children}
    {activeDialog ? createPortal(viewport, activeDialog) : viewport}
  </ToastContext.Provider>;
}
