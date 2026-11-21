import { Shield } from "lucide-react";

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Shield size={27} />
      <p>{text}</p>
    </div>
  );
}
