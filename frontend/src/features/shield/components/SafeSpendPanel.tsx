"use client";

import { CircleDollarSign, Wallet } from "lucide-react";
import { money } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

/** Wallet balance minus bills due in the next seven days. */
export function SafeSpendPanel() {
  const { data, currency, totals } = useWorkspace();
  const { totalBalance, locked } = totals;
  const safeShare = Math.min(100, Math.max(4, ((totalBalance - locked) / Math.max(1, totalBalance)) * 100));
  return (
    <section className="panel safe-spend">
      <div className="panel-top">
        <span>
          Safe to spend <span className="badge green compact-badge">AVAILABLE</span>
        </span>
        <span className="icon-well">
          <Wallet size={17} />
        </span>
      </div>
      <div className="safe-amount">
        {money(Math.max(0, totalBalance - locked), currency)}
        <span>{currency}</span>
      </div>
      <p>After upcoming bills. Ready for what’s next.</p>
      <div className="balance-bar">
        <span style={{ width: `${safeShare}%` }} />
        <i />
      </div>
      <div className="balance-details">
        <span>
          <i className="legend-dot lime" />
          Total wallet<b>{money(totalBalance, currency)}</b>
        </span>
        <span>
          <i className="legend-dot muted" />
          Locked · next 7 days<b>{money(locked, currency)}</b>
        </span>
      </div>
      <div className="wallet-currencies">
        <span>
          <span className="flag" />
          NGN <b>{money(data.user.ngn_balance)}</b>
        </span>
        <span>
          <CircleDollarSign size={13} />
          USD <b>{money(data.user.usd_balance, "USD", true)}</b>
        </span>
      </div>
    </section>
  );
}
