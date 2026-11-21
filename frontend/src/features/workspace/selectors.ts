import { daysUntil, type Currency, type Dashboard } from "@retrest/shared";
import { unreadNotifications } from "@/features/notifications/selectors";

/** Converts minor units between NGN and USD at the workspace's simulated rate. */
export const convert = (
  data: Dashboard,
  amount: number,
  from: Currency,
  to: Currency,
) =>
  from === to
    ? amount
    : to === "NGN"
      ? amount * data.exchange_rate
      : amount / data.exchange_rate;

/** Every derived number the Shield, Pools and Insights screens display, in the chosen currency. */
export function workspaceTotals(data: Dashboard, currency: Currency) {
  const inDisplay = (amount: number, from: Currency) =>
    convert(data, amount, from, currency);
  const active = data.subscriptions.filter((s) => s.status === "ACTIVE");
  const paused = data.subscriptions.filter((s) => s.status === "PAUSED");
  const totalBalance =
    inDisplay(data.user.ngn_balance, "NGN") +
    inDisplay(data.user.usd_balance, "USD");
  // Upcoming bills in the next 7 days, less what their shared pools already hold.
  const locked = active
    .filter((s) => daysUntil(s.next_billing_date) <= 7)
    .reduce((sum, s) => {
      const pool = data.pools.find((p) => p.subscription_id === s.id);
      return (
        sum +
        inDisplay(
          Math.max(0, s.expected_amount - (pool?.pool_balance ?? 0)),
          s.currency,
        )
      );
    }, 0);
  const blocked = data.transactions.filter((t) =>
    t.status.startsWith("DECLINED"),
  );
  // A blocked price hike saves the overage; any other block saves the whole charge.
  const shieldSavings = blocked.reduce((sum, t) => {
    const sub = data.subscriptions.find((s) => s.id === t.subscription_id);
    const saved =
      t.status === "DECLINED_PRICE_HIKE"
        ? Math.max(0, t.amount - (sub?.expected_amount ?? t.amount))
        : t.amount;
    return sum + inDisplay(saved, t.currency);
  }, 0);
  return {
    active,
    paused,
    totalBalance,
    locked,
    blocked,
    shieldSavings,
    unread: unreadNotifications(data.notifications),
    poolContributions: data.pools.reduce(
      (sum, p) => sum + inDisplay(p.pool_balance, p.currency),
      0,
    ),
    pendingContributions: data.pools.reduce(
      (sum, p) =>
        sum + p.members.filter((m) => m.payment_status !== "PAID").length,
      0,
    ),
    inDisplay,
  };
}

export type WorkspaceTotals = ReturnType<typeof workspaceTotals>;

export const hasPool = (data: Dashboard, subscriptionId: string) =>
  data.pools.some((p) => p.subscription_id === subscriptionId);
