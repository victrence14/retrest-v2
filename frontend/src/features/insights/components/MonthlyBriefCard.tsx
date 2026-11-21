"use client";

import { ArrowUpRight, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

export function MonthlyBriefCard() {
  const { openDialog } = useWorkspace();
  return (
    <section className="panel monthly-brief-card">
      <span className="brief-orb">
        <Sparkles size={25} />
      </span>
      <div className="eyebrow">YOUR MONTHLY MONEY BRIEF</div>
      <h2>
        Less guesswork.
        <br />
        More clarity.
      </h2>
      <p>NGN and USD spend, your top categories, and the charges your shield stopped. All in one monthly summary.</p>
      <div className="brief-tags">
        <span>
          <CheckCircle2 size={13} /> Actual payment activity
        </span>
        <span>
          <MessageCircle size={13} /> Email-ready
        </span>
      </div>
      <button className="button primary" onClick={() => openDialog({ kind: "summary" })}>
        <Sparkles size={15} /> Generate spend summary <ArrowUpRight size={15} />
      </button>
      <small>AI summary preview · generated from demo transactions</small>
    </section>
  );
}
