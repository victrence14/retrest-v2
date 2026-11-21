"use client";

import { useState } from "react";
import { Activity, ChevronRight, CreditCard, LoaderCircle, LockKeyhole, RefreshCw, Zap } from "lucide-react";
import type { DemoScenario } from "@retrest/shared";
import { DialogHeading } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { resetDemo, runScenario } from "../api";
import { SCENARIOS } from "../scenarios";
import { DemoResultCard } from "./DemoResultCard";

/** Live charge simulator: sends issuer charges through the real authorization engine. */
export function SimulatorDialog() {
  const { profile, busy, mutate, notify, demoResult, setDemoResult } = useWorkspace();
  const [running, setRunning] = useState<DemoScenario | null>(null);

  async function simulate(scenario: DemoScenario) {
    if (busy) return;
    setRunning(scenario);
    setDemoResult(null);
    const result = await mutate(() => runScenario(scenario));
    if (result) {
      const { state: _state, ...decision } = result;
      setDemoResult(decision);
      notify(
        result.decision === "APPROVE"
          ? `${result.merchant_name} payment approved. Receipt ready.`
          : `${result.merchant_name}: ${result.reason}`,
      );
    }
    setRunning(null);
  }

  async function reset() {
    const done = await mutate(resetDemo, "Demo reset. All wallets, pools, and merchant rules restored.");
    if (done) setDemoResult(null);
  }

  return (
    <>
      <DialogHeading
        kicker={<><Zap size={14} /> BUILDATHON · LIVE AUTHORIZATION</>}
        title={<>Your shield.<br />Put to the test</>}
        description="Send a simulated issuer webhook. See the decision, funding, and receipt from the live authorization engine."
      />
      <div className="demo-card-mini">
        <CreditCard size={22} />
        <div>
          <b>One master card</b>
          <span>•••• 4289 · {profile.name}</span>
        </div>
        <span className="badge green">Live engine</span>
      </div>
      <div className="demo-scenarios">
        {SCENARIOS.map((s) => (
          <button className="demo-scenario" key={s.id} disabled={busy} onClick={() => simulate(s.id)}>
            <span className={`scenario-icon ${s.tone}`}>
              <s.icon size={20} />
            </span>
            <span>
              <b>{s.title}</b>
              <small>{s.description}</small>
            </span>
            <span className="scenario-tag">{running === s.id ? <LoaderCircle size={15} className="spin" /> : s.tag}</span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      {demoResult ? (
        <DemoResultCard result={demoResult} />
      ) : (
        <div className="demo-waiting">
          <Activity size={22} />
          <span>
            Your shield is listening.
            <small>Choose a scenario to send a charge.</small>
          </span>
        </div>
      )}
      <div className="demo-disclaimer">
        <LockKeyhole size={13} />
        <span>These are simulated charges using the real authorization engine. Demo wallet balances update and persist.</span>
      </div>
      <button className="demo-reset text-button" disabled={busy} onClick={reset}>
        <RefreshCw size={13} /> Reset demo to starting balances
      </button>
    </>
  );
}
