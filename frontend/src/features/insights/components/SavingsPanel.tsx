"use client";

import { Sparkles } from "lucide-react";
import { money } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

export function SavingsPanel() {
  const { data, currency, totals } = useWorkspace();
  return (
    <section className="panel insight-savings">
      <span className="icon-well">
        <Sparkles size={20} />
      </span>
      <small>YOUR SHIELD AT WORK</small>
      <strong>{money(totals.shieldSavings, currency)}</strong>
      <p>
        in attempted overcharges
        <br />
        and paused payments blocked.
      </p>
      <div>
        <span>{totals.blocked.length} blocks</span>
        <span>{money(data.user.fx_converted_ngn)} converted</span>
      </div>
    </section>
  );
}
