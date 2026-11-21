"use client";

import { ArrowRight, CreditCard, Globe, ShieldCheck, ShieldOff, Users, Zap } from "lucide-react";
import { DialogHeading } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

const HOW_IT_WORKS = [
  { icon: CreditCard, title: "One card for every subscription", text: "Connect a merchant, set a monthly maximum, and use the master card at checkout." },
  { icon: ShieldOff, title: "Pause a merchant in one tap", text: "The kill switch blocks that merchant immediately. Your other payments keep working." },
  { icon: Globe, title: "Dollars only when you need them", text: "Auto-FX converts the exact USD shortfall from your NGN wallet at the simulated rate." },
  { icon: Users, title: "Share a plan, share the cost", text: "Pool contributions fund the bill first. You choose whether your wallet covers the gap." },
];

export function HelpDialog() {
  const { openDialog } = useWorkspace();
  return (
    <>
      <DialogHeading
        kicker={<><ShieldCheck size={16} /> MEET YOUR FINANCIAL SIDEKICK</>}
        title={<>Your money.<br />Your rules</>}
        description="RETREST gives every recurring payment its own set of permissions, all on one master virtual card."
      />
      <div className="how-it-works">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.title}>
            <step.icon size={21} />
            <span>
              <b>{step.title}</b>
              <p>{step.text}</p>
            </span>
          </div>
        ))}
      </div>
      <div className="form-callout">
        <Zap size={17} />
        <span>This buildathon MVP uses a persistent demo wallet and simulated issuer charges. No real card is issued or charged.</span>
      </div>
      <button className="button primary full-width" onClick={() => openDialog({ kind: "demo" })}>
        See it in action <ArrowRight size={16} />
      </button>
    </>
  );
}
