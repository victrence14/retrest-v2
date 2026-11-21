import { ShieldCheck } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-symbol">
        <ShieldCheck size={23} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span>
          retrest<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
