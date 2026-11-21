import type { DatabaseSync } from "node:sqlite";
import type {
  Card,
  Dashboard,
  Notification,
  Pool,
  PoolMember,
  Subscription,
  Transaction,
  User,
} from "@retrest/shared";
import { EXCHANGE_RATE } from "../constants.ts";

/** The complete workspace snapshot every screen renders from. */
export function getDashboard(db: DatabaseSync, userId: string, demoEnabled: boolean): Dashboard {
  const pools = db
    .prepare(
      "SELECT p.*,s.merchant_name,s.next_billing_date FROM split_pools p JOIN merchant_subscriptions s ON s.id=p.subscription_id WHERE host_user_id=?",
    )
    .all(userId) as unknown as Pool[];
  const members = db.prepare("SELECT * FROM pool_members WHERE pool_id=? ORDER BY user_id IS NULL, name");
  for (const pool of pools) pool.members = members.all(pool.id) as unknown as PoolMember[];

  return {
    user: db.prepare("SELECT * FROM users WHERE id=?").get(userId) as unknown as User,
    card: db.prepare("SELECT * FROM virtual_cards WHERE user_id=?").get(userId) as unknown as Card,
    subscriptions: db
      .prepare("SELECT * FROM merchant_subscriptions WHERE user_id=? ORDER BY next_billing_date")
      .all(userId) as unknown as Subscription[],
    pools,
    transactions: db
      .prepare(
        "SELECT t.*,s.is_business_expense FROM transaction_logs t LEFT JOIN merchant_subscriptions s ON s.id=t.subscription_id WHERE t.user_id=? ORDER BY t.created_at DESC LIMIT 100",
      )
      .all(userId) as unknown as Transaction[],
    notifications: db
      .prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30")
      .all(userId) as unknown as Notification[],
    exchange_rate: EXCHANGE_RATE,
    demo_enabled: demoEnabled,
  };
}
