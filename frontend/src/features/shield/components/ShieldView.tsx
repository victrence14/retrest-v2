"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { ActivityPanel } from "./ActivityPanel";
import { MasterCard } from "./MasterCard";
import { SafeSpendPanel } from "./SafeSpendPanel";
import { ShieldSummaryPanel } from "./ShieldSummaryPanel";
import { SubscriptionsPanel } from "./SubscriptionsPanel";

/** The Shield section: card, balances, merchant rules, and live activity. */
export function ShieldView() {
  const { totals } = useWorkspace();
  const router = useRouter();
  const firstPaused = totals.paused[0];
  return (
    <>
      <div className="overview-grid">
        <MasterCard />
        <SafeSpendPanel />
        <ShieldSummaryPanel />
      </div>
      <div className="section-grid">
        <SubscriptionsPanel />
        <ActivityPanel />
      </div>
      <div className="bottom-insight">
        <span className="insight-symbol">
          <Sparkles size={17} />
        </span>
        <p>
          A little heads-up: <b>{firstPaused ? `${firstPaused.merchant_name} is paused.` : "Your shield is up."}</b>{" "}
          {firstPaused ? "We’ll block every charge until you say otherwise." : "Every merchant is following your rules."}
        </p>
        <button onClick={() => router.push("/insights?demo=1")}>
          See your insights <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
