"use client";

import { ArrowRight, CircleDollarSign, Globe, ShieldCheck, Zap } from "lucide-react";
import { money } from "@retrest/shared";
import { Toggle } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { setAutoFxPreference } from "@/features/settings/api";

export function FxPanel() {
  const { data, busy, mutate } = useWorkspace();
  return (
    <section className="panel fx-panel">
      <div className="section-header">
        <div>
          <h2>
            <Globe size={19} /> FX auto-conversion
          </h2>
          <p>NGN → USD. Exactly when you need it.</p>
        </div>
        <span className="badge green">SMART TREASURY</span>
      </div>
      <div className="fx-rate">
        <span className="fx-currency">
          <CircleDollarSign size={22} />
          <b>1 USD</b>
        </span>
        <ArrowRight size={20} />
        <span className="fx-currency">
          <span className="flag" />
          <b>{money(data.exchange_rate * 100)}</b>
        </span>
        <span className="rate-label">
          <span className="status-dot" />
          SIMULATED LIVE RATE
        </span>
      </div>
      <div className="fx-setting">
        <span className="icon-well">
          <Zap size={19} />
        </span>
        <div>
          <b>Just-in-time auto-conversion</b>
          <p>
            Short on dollars? Convert only what you need from NGN,
            <br className="desktop-br" /> right when your subscription charges.
          </p>
        </div>
        <Toggle
          on={!!data.user.auto_fx_enabled}
          disabled={busy}
          onClick={() => mutate(() => setAutoFxPreference(!data.user.auto_fx_enabled), "Auto-conversion preference saved")}
          label="Automatic NGN to USD conversion"
        />
      </div>
      <div className="fx-bottom">
        <span>
          <ShieldCheck size={15} /> No pre-funding. No idle dollars.
        </span>
        <span>0% demo FX markup</span>
      </div>
    </section>
  );
}
