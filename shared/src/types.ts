export type Currency = "NGN" | "USD";
export type SubscriptionStatus = "ACTIVE" | "PAUSED";
export interface User {
  id: string;
  name: string;
  email: string;
  ngn_balance: number;
  usd_balance: number;
  auto_fx_enabled: number;
  fx_converted_ngn: number;
}
export interface Card {
  id: string;
  user_id: string;
  masked_pan: string;
  expiry: string;
  card_status: string;
  provider_card_id: string;
}
export interface Subscription {
  id: string;
  user_id: string;
  merchant_name: string;
  merchant_descriptor: string;
  category: string;
  status: SubscriptionStatus;
  expected_amount: number;
  expected_max_amount: number;
  currency: Currency;
  billing_cycle: string;
  next_billing_date: string;
  is_business_expense: number;
  needs_review: number;
  plan_name: string;
}
export interface PoolMember {
  id: string;
  pool_id: string;
  user_id: string | null;
  name: string;
  email: string;
  share_amount: number;
  payment_status: "PAID" | "PENDING" | "OVERDUE";
  auto_debit_scheduled: number;
}
export interface Pool {
  id: string;
  subscription_id: string;
  host_user_id: string;
  name: string;
  pool_balance: number;
  target_amount: number;
  currency: Currency;
  status: string;
  fallback_enabled: number;
  invite_token: string;
  members: PoolMember[];
  merchant_name: string;
  next_billing_date: string;
}
export interface Transaction {
  id: string;
  authorization_id: string;
  user_id: string;
  subscription_id: string | null;
  merchant_name: string;
  amount: number;
  currency: Currency;
  status: string;
  decline_reason: string | null;
  receipt_url: string | null;
  fx_ngn_amount: number;
  pool_amount: number;
  created_at: string;
  is_business_expense?: number;
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  subscription_id: string | null;
  transaction_id: string | null;
}
export interface Dashboard {
  user: User;
  card: Card;
  subscriptions: Subscription[];
  pools: Pool[];
  transactions: Transaction[];
  notifications: Notification[];
  exchange_rate: number;
  demo_enabled: boolean;
}
export interface AuthorizationPayload {
  authorization_id: string;
  provider_card_id: string;
  merchant_descriptor: string;
  amount: number;
  currency: Currency;
}
export interface AuthorizationDecision {
  decision: "APPROVE" | "DECLINE";
  reason: string;
  transaction_id: string;
  receipt_url: string | null;
  fx_ngn_amount: number;
  pool_amount: number;
  amount: number;
  currency: Currency;
  merchant_name: string;
}

/* ---------- API contracts (request/response shapes shared by frontend and backend) ---------- */

export type DemoScenario = "normal" | "paused" | "hike" | "fx" | "pool";

/** POST /api/demo: the engine decision plus timing and the refreshed workspace. */
export interface DemoResult extends AuthorizationDecision {
  http_status: number;
  duration_ms: number;
  state: Dashboard;
}

export interface CreatePoolMember {
  name: string;
  email: string;
  share_amount: number;
}

/** POST /api/pools body. */
export interface CreatePoolInput {
  subscription_id: string;
  name: string;
  members: CreatePoolMember[];
  fallback_enabled?: boolean;
}

/** POST /api/pools response. */
export interface CreatePoolResult {
  state: Dashboard;
  invite_token: string;
}

/** POST /api/subscriptions body. */
export interface CreateSubscriptionInput {
  merchant_name: string;
  merchant_descriptor: string;
  expected_amount: number;
  currency: Currency;
  next_billing_date: string;
  is_business_expense: boolean;
}

/** GET /api/invites/:token: the public pool invitation. */
export interface InviteSummary {
  name: string;
  host_name: string;
  merchant_name: string;
  target_amount: number;
  pool_balance: number;
  currency: Currency;
  next_billing_date: string;
  demo_enabled: boolean;
}
