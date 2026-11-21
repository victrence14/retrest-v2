"use client";

import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { money } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

export function ShieldSummaryPanel() {
  const { data, currency, totals } = useWorkspace();
  const router = useRouter();
  return (
    <section className="panel shield-summary">
      <div className="panel-top">
        <span>Your shield is on</span>
        <ShieldCheck size={18} className="lime-text" />
      </div>
      <div className="shield-summary-number">
        {totals.active.length}
        <span>/{data.subscriptions.length}</span>
      </div>
      <p>subscriptions actively protected</p>
      <div className="shield-divider" />
      <div className="saved-label">
        <span className="tiny-icon">
          <ArrowDownLeft size={15} />
        </span>
        Kept in your pocket
      </div>
      <strong>{money(totals.shieldSavings, currency)}</strong>
      <span className="summary-note">from {totals.blocked.length} blocked attempts</span>
      <button className="text-button" onClick={() => router.push("/insights")}>
        Meet your insights <ArrowUpRight size={15} />
      </button>
    </section>
  );
}
