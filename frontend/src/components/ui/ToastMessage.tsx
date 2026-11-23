import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import type { Toast } from "@/hooks/useToast";

export function ToastMessage({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"} aria-atomic="true">
      {toast.error ? <TriangleAlert size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
      <span>{toast.text}</span>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
