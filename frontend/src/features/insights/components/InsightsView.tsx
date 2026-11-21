"use client";

import { Globe } from "lucide-react";
import { money } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { FxPanel } from "./FxPanel";
import { MonthlyBriefCard } from "./MonthlyBriefCard";
import { SavingsPanel } from "./SavingsPanel";
import { VaultPanel } from "./VaultPanel";
import { ZombiePanel } from "./ZombiePanel";

/** Simulated market FX fee that zero-markup conversion avoids. */
const COMPARISON_FX_FEE = 0.015;

/** The Insights & Vault section. */
export function InsightsView() {
  const { data } = useWorkspace();
  return (
    <>
      <div className="fx-fees-note">
        <Globe size={16} />
        <span>
          <b>{money(Math.round(data.user.fx_converted_ngn * COMPARISON_FX_FEE))}</b> in FX fees avoided with zero-markup conversion.
        </span>
        <small>Compared with a simulated 1.5% FX fee</small>
      </div>
      <div className="insights-grid">
        <FxPanel />
        <SavingsPanel />
      </div>
      <div className="treasury-tools">
        <MonthlyBriefCard />
        <ZombiePanel />
      </div>
      <VaultPanel />
    </>
  );
}
