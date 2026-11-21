import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import type { Toast } from "@/hooks/useToast";

export function ToastMessage({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`toast ${toast.error ? "error" : ""}`} role="status">
      {toast.error ? <TriangleAlert size={18} /> : <CheckCircle2 size={18} />}
      <span>{toast.text}</span>
      <button aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
