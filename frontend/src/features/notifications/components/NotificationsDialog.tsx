"use client";

import { Bell, TriangleAlert } from "lucide-react";
import { money } from "@retrest/shared";
import { DialogHeading, EmptyState } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { setMerchantLimit } from "@/features/shield/api";

/** Unread price-hike alerts; approving one raises that merchant's limit to the blocked amount. */
export function NotificationsDialog() {
  const { data, totals, busy, mutate } = useWorkspace();
  return (
    <>
      <DialogHeading
        kicker={<><Bell size={16} /> YOUR SHIELD HAS AN UPDATE</>}
        title="Always in the loop"
        description="Approve new limits only when a price increase works for you."
      />
      {!totals.unread.length ? (
        <EmptyState text="All quiet here. Your shield is keeping watch." />
      ) : (
        <div className="notification-list">
          {totals.unread.map((n) => {
            const blocked = data.transactions.find((t) => t.id === n.transaction_id);
            return (
              <div className="notification-card" key={n.id}>
                <TriangleAlert size={19} />
                <div>
                  <b>{n.title}</b>
                  <p>{n.message}</p>
                  {blocked && n.subscription_id && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          () => setMerchantLimit(n.subscription_id!, blocked.amount),
                          "New maximum approved. The merchant can retry its payment.",
                        )
                      }
                    >
                      Approve new limit · {money(blocked.amount, blocked.currency)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
