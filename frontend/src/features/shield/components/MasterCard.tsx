"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Eye, EyeOff, Zap } from "lucide-react";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

/** Demo-only card details; real PAN/CVV belong in an issuer-hosted reveal flow. */
const DEMO_CARD_NUMBER = "4242424242424289";

export function MasterCard() {
  const { data, profile, copy, copied, openDialog } = useWorkspace();
  const [revealed, setRevealed] = useState(false);
  return (
    <section className="master-card">
      <div className="card-top">
        <div className="card-brand">
          retrest<span>↗</span>
        </div>
        <span className={"card-active " + (data.card.card_status === "FROZEN" ? "frozen" : "")}>
          <span />
          {data.card.card_status}
        </span>
      </div>
      <div className="card-middle">
        <div className="card-chip">
          <span />
          <span />
          <span />
        </div>
        <span className="contactless">)))</span>
        <div className="card-contours">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="card-number">
        <span>{revealed ? "4242  4242  4242  4289" : "••••  ••••  ••••  4289"}</span>
        <button aria-label={revealed ? "Hide card details" : "Reveal demo card details"} onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
        <button aria-label="Copy demo card number" onClick={() => copy(DEMO_CARD_NUMBER)}>
          {copied ? <Check size={16} /> : <Copy size={15} />}
        </button>
      </div>
      <div className="card-bottom">
        <div>
          <small>CARDHOLDER</small>
          <span>{profile.name.toUpperCase()}</span>
        </div>
        <div>
          <small>{revealed ? "EXPIRY / DEMO CVV" : "VALID THRU"}</small>
          <span>{revealed ? "08/29 · 123" : "08/29"}</span>
        </div>
        <div className="mastercard-logo">
          <i />
          <i />
        </div>
      </div>
      <div className="card-demo-label">
        <span>VIRTUAL DEBIT · DEMO CARD</span>
        <button onClick={() => openDialog({ kind: "demo" })}>
          <Zap size={12} /> Simulate incoming charge <ArrowUpRight size={12} />
        </button>
      </div>
    </section>
  );
}
