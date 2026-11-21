"use client";

import { useState } from "react";
import { ChevronRight, LockKeyhole, Plus, Search, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { daysUntil, money, shortDate, type Subscription } from "@retrest/shared";
import { EmptyState, MerchantLogo, Toggle } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { hasPool } from "@/features/workspace/selectors";

type StatusFilter = "all" | "active" | "paused";
const FILTERS: StatusFilter[] = ["all", "active", "paused"];

const matches = (s: Subscription, filter: StatusFilter, search: string) =>
  (filter === "all" || s.status.toLowerCase() === filter) &&
  `${s.merchant_name} ${s.category}`.toLowerCase().includes(search.toLowerCase());

/** Connected merchants with search, status filter, and per-merchant kill switches. */
export function SubscriptionsPanel() {
  const { data, totals, busy, openDialog, toggleSubscription } = useWorkspace();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const visible = data.subscriptions.filter((s) => matches(s, filter, search));
  const manage = (subscription: Subscription) => openDialog({ kind: "merchant", subscription });

  return (
    <section className="panel subscriptions-panel">
      <div className="section-header">
        <div>
          <h2>
            Connected subscriptions <span className="count-badge">{data.subscriptions.length}</span>
          </h2>
          <p>A separate set of rules. One powerful card.</p>
        </div>
        <button className="text-button" onClick={() => openDialog({ kind: "add" })}>
          <Plus size={15} /> Add subscription
        </button>
      </div>
      <div className="table-toolbar">
        <div className="segmented">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All subscriptions" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "paused" && <span>{totals.paused.length}</span>}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search subscriptions"
              placeholder="Find a subscription"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="icon-button"
            aria-label="Show active subscriptions"
            onClick={() => setFilter(filter === "active" ? "all" : "active")}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="subscription-table">
          <thead>
            <tr>
              <th>SUBSCRIPTION</th>
              <th>NEXT PAYMENT</th>
              <th>AMOUNT</th>
              <th>SHIELD</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((sub) => {
              const active = sub.status === "ACTIVE";
              const days = daysUntil(sub.next_billing_date);
              return (
                <tr key={sub.id} className={active ? "" : "paused-row"}>
                  <td>
                    <button className="merchant-cell" onClick={() => manage(sub)}>
                      <MerchantLogo name={sub.merchant_name} />
                      <span>
                        <b>
                          {sub.merchant_name}
                          {hasPool(data, sub.id) && <Users size={12} className="pool-indicator" />}
                        </b>
                        <small>{sub.plan_name}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="renewal-date">{shortDate(sub.next_billing_date)}</span>
                    <small className={`renewal-count ${days <= 3 ? "soon" : ""}`}>
                      {active ? `in ${days} days` : "Payment blocked"}
                    </small>
                  </td>
                  <td>
                    <b className="table-amount">{money(sub.expected_amount, sub.currency)}</b>
                    <small className="amount-cycle">/ month</small>
                  </td>
                  <td>
                    <div className="shield-cell">
                      <Toggle
                        on={active}
                        disabled={busy}
                        onClick={() => toggleSubscription(sub)}
                        label={`${active ? "Pause" : "Activate"} ${sub.merchant_name}`}
                      />
                      <span className={active ? "lime-text" : "muted-text"}>{active ? "Active" : "Paused"}</span>
                    </div>
                  </td>
                  <td>
                    <button className="icon-button row-details" aria-label={`Manage ${sub.merchant_name}`} onClick={() => manage(sub)}>
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <EmptyState text="No subscriptions match your search." />}
      </div>
      <div className="table-footer">
        <ShieldCheck size={14} />
        <span>Price-hike protection is active on every connected subscription.</span>
        <LockKeyhole size={13} />
      </div>
    </section>
  );
}
