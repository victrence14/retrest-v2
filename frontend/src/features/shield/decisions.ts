import type { Transaction } from "@retrest/shared";

/** How an authorization outcome is presented in activity feeds. */
export function decisionDisplay(status: Transaction["status"]) {
  if (status === "APPROVED") return { tone: "approved", title: "Payment approved" } as const;
  if (status === "DECLINED_PRICE_HIKE") return { tone: "hike", title: "Price hike blocked" } as const;
  if (status === "DECLINED_KILL_SWITCH") return { tone: "blocked", title: "Kill switch blocked" } as const;
  return { tone: "blocked", title: "Payment blocked" } as const;
}
