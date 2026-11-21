"use client";

import { ArrowRight, Plus, ShieldCheck, Users } from "lucide-react";
import { money } from "@retrest/shared";
import { Avatar } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { PoolCard } from "./PoolCard";

/** The Pools & Split section: summary strip, one card per pool, and a create card. */
export function PoolsView() {
  const { data, currency, totals, openDialog } = useWorkspace();
  const pending = totals.pendingContributions;
  return (
    <>
      <div className="pool-summary-strip">
        <div>
          <span className="icon-well">
            <Users size={20} />
          </span>
          <span>
            <small>YOUR SHARED PLANS</small>
            <strong>{data.pools.length} active shared plans</strong>
          </span>
        </div>
        <div>
          <small>TOTAL CONTRIBUTIONS</small>
          <strong>{money(totals.poolContributions, currency)}</strong>
        </div>
        <div>
          <small>WAITING ON A FRIEND</small>
          <strong>
            {pending} contribution{pending === 1 ? "" : "s"}
          </strong>
        </div>
        <span className="badge green">
          <ShieldCheck size={12} /> Shield protected
        </span>
      </div>
      <div className="pool-grid">
        {data.pools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
        <button className="new-pool-card" onClick={() => openDialog({ kind: "create-pool" })}>
          <span>
            <Plus size={26} />
          </span>
          <h3>Better together.</h3>
          <p>
            Netflix night? A creative side hustle?
            <br />
            There’s a pool for that.
          </p>
          <b>
            Create a new pool <ArrowRight size={16} />
          </b>
          <div className="avatar-stack">
            <Avatar name="Ada Okafor" index={0} />
            <Avatar name="Tobi Adebayo" index={1} />
            <Avatar name="Chioma Eze" index={2} />
            <span>+ you</span>
          </div>
        </button>
      </div>
      <div className="bottom-insight">
        <ShieldCheck size={18} />
        <p>
          Your master card stays the same. <b>Pool funds are used first, your wallet only fills the gap.</b>
        </p>
      </div>
    </>
  );
}
