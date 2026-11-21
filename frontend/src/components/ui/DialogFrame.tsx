"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export interface DialogFrameProps {
  label: string;
  /** Side drawer instead of a centred modal. */
  drawer?: boolean;
  /** Extra class for the dialog panel, e.g. "demo-drawer". */
  className?: string;
  /** While busy, clicking the backdrop does not close the dialog. Escape and the close button still do. */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Accessible modal/drawer shell shared by every workspace dialog. */
export function DialogFrame({ label, drawer = false, className = "", busy = false, onClose, children }: DialogFrameProps) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, onClose);
  return (
    <div className={`modal-backdrop ${drawer ? "drawer-backdrop" : ""}`} onClick={() => !busy && onClose()}>
      <section
        ref={dialog}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
