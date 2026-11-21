"use client";

import { EyeOff, Pause, ShieldCheck } from "lucide-react";
import { money, type Subscription } from "@retrest/shared";
import { MerchantLogo } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

/** Seeded demo merchants that the check-in always surfaces alongside flagged ones. */
const ALWAYS_REVIEW = new Set(["aws", "youtube"]);
const needsCheckIn = (s: Subscription) => !!s.needs_review || ALWAYS_REVIEW.has(s.id);

/** Plans worth a second look, each with a one-tap kill switch. */
export function ZombiePanel() {
  const { data, busy, toggleSubscription } = useWorkspace();
  return (
    <section className="panel zombie-panel">
      <div className="section-header">
        <div>
          <h2>
            <EyeOff size={18} /> Zombie subscriptions
          </h2>
          <p>Unused plans deserve a second look.</p>
        </div>
        <span className="badge amber">SUBSCRIPTION CHECK-IN</span>
      </div>
      {data.subscriptions.filter(needsCheckIn).map((s) => {
        const paused = s.status === "PAUSED";
        return (
          <div className="zombie-row" key={s.id}>
            <MerchantLogo name={s.merchant_name} />
            <div>
              <b>{s.merchant_name}</b>
              <p>
                {s.id === "youtube"
                  ? "Flagged for review · You haven’t used this in a while"
                  : "Review your usage · Is this still earning its place?"}
              </p>
            </div>
            <span>
              {money(s.expected_amount, s.currency)}
              <small>/month</small>
            </span>
            <button className={`button ${paused ? "subtle" : "secondary"}`} disabled={paused || busy} onClick={() => toggleSubscription(s)}>
              {paused ? (
                <>
                  <ShieldCheck size={15} /> Kill switch active
                </>
              ) : (
                <>
                  <Pause size={15} /> Activate kill switch
                </>
              )}
            </button>
          </div>
        );
      })}
    </section>
  );
}
