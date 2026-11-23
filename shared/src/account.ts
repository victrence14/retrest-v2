import type { Currency } from "./types.ts";

/** Account contracts use integer minor units; aggregate amounts are exact strings. */
export type PaymentStatus = "PENDING" | "SETTLED" | "DECLINED" | "REVERSED";
export interface Page<T> { data: T[]; next_cursor: string | null }
export interface AccountUser { id: string; email: string; email_verified: boolean }
export interface ProfileRecord { id: string; display_name: string; created_at: string; updated_at: string }
export interface CategoryRecord { slug: string; label: string }
export interface SubscriptionRecord {
  id: string; user_id: string; name: string; merchant_descriptor: string | null;
  category_slug: string | null; amount_minor: number; expected_max_amount: number;
  currency: Currency; active: boolean; billing_cycle: "MONTHLY" | "YEARLY";
  next_billing_date: string | null; is_business_expense: boolean; needs_review: boolean;
  created_at: string; updated_at: string;
}
export interface SubscriptionInput {
  name: string; merchant_descriptor: string; amount_minor: number; currency: Currency;
  next_billing_date: string; category_slug?: string | null; expected_max_amount?: number;
  active?: boolean; billing_cycle?: "MONTHLY" | "YEARLY"; is_business_expense?: boolean;
}
export interface PoolRecord {
  id: string; host_user_id: string; subscription_id: string; name: string;
  target_amount: number; currency: Currency; balance_minor: number;
  fallback_enabled: boolean; status: "ACTIVE" | "CLOSED"; created_at: string; updated_at: string;
}
export interface PoolMemberRecord {
  id: string; pool_id: string; user_id: string | null; display_name: string;
  invited_email: string; share_amount: number; payment_status: "UNPAID" | "PAID"; accepted_at: string | null;
}
export interface PoolInput {
  subscription_id: string; name: string; fallback_enabled?: boolean;
  members: { display_name: string; email: string; share_amount: number }[];
}
export interface InviteRecord {
  id: string; pool_id: string; member_id: string; expires_at: string;
  accepted_at: string | null; revoked_at: string | null; created_at: string;
}
export interface AccountInvite { invite: InviteRecord; pool: PoolRecord; member: PoolMemberRecord }
export interface ContributionRecord {
  id: string; pool_id: string; member_id: string; user_id: string; amount_minor: number;
  currency: Currency; status: "PENDING" | "SETTLED" | "FAILED"; created_at: string; settled_at: string | null;
}
export interface TransactionRecord {
  id: string; user_id: string; subscription_id: string | null; provider_transaction_id: string;
  merchant_name: string; amount_minor: number; currency: Currency; status: PaymentStatus;
  is_business_expense: boolean; fx_ngn_amount: number; pool_amount: number;
  decline_reason: string | null; created_at: string; settled_at: string | null; updated_at: string;
  receipt_url?: string | null;
}
export interface CurrencyTotal {
  currency: Currency; settled_count: number; pending_count: number; declined_count: number;
  reversed_count: number; settled_amount_minor: string; fx_ngn_amount_minor: string; pool_amount_minor: string;
}
export interface PeriodSummary { from: string; to: string; totals: CurrencyTotal[] }
export interface SettingsRecord {
  user_id: string; auto_fx_enabled: boolean; phone: string | null;
  theme: "system" | "light" | "dark"; time_zone: string;
  email_notifications: boolean; monthly_summary_email: boolean; updated_at: string;
}
export type SettingsPatch = Partial<Omit<SettingsRecord, "user_id" | "updated_at">>;
export interface DeviceRecord {
  id: string; name: string; created_at: string; last_used_at: string;
  expires_at: string; revoked_at: string | null;
}
export interface AccountNotification {
  id: string; title: string; message: string; read_at: string | null; created_at: string;
  resource_type: "subscription" | "transaction" | "pool" | "support" | "summary" | null;
  resource_id: string | null;
}
export interface SupportThreadRecord {
  id: string; user_id: string; subject: string; status: "OPEN" | "CLOSED";
  created_at: string; updated_at: string;
}
export interface SupportMessageRecord {
  id: string; thread_id: string; sender_role: "CUSTOMER" | "AGENT";
  body: string; created_at: string;
}
export interface MonthlySummaryRecord {
  id: string; user_id: string; month: string; totals: CurrencyTotal[]; created_at: string;
}
export type EmailStatus = "QUEUED" | "PROCESSING" | "ACCEPTED" | "DELIVERED" | "BOUNCED" | "FAILED";
export interface EmailJobRecord {
  id: string; summary_id: string; status: EmailStatus; attempts: number;
  created_at: string; updated_at: string;
}
