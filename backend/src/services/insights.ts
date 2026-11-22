import type { SupabaseClient } from '@supabase/supabase-js';
import { totalsByCurrency, type CurrencyTotal } from './documents.js';

export interface MerchantTotal {
  merchant_name: string;
  currency: string;
  count: number;
  approved_minor: number;
}

export interface ReviewFlag {
  type: string;
  merchant_name: string;
  transaction_id?: string;
  subscription_id?: string;
  evidence: Record<string, unknown>;
}

export interface InsightsResult {
  month: string;
  totals: CurrencyTotal[];
  top_merchants: MerchantTotal[];
  review_flags: ReviewFlag[];
}

export function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function buildInsights(db: SupabaseClient, userId: string, month: string): Promise<InsightsResult> {
  const { start, end } = monthRange(month);
  const rows = await db.from('transactions')
    .select('id, merchant_name, amount_minor, currency, status, decline_reason, fx_ngn_amount, created_at')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(5000);
  const transactions = (rows.data ?? []) as Array<Record<string, unknown>>;
  const totals = totalsByCurrency(transactions);

  const merchants = new Map<string, MerchantTotal>();
  for (const transaction of transactions) {
    const key = `${String(transaction.merchant_name)}:${String(transaction.currency)}`;
    const entry = merchants.get(key) ?? {
      merchant_name: String(transaction.merchant_name),
      currency: String(transaction.currency),
      count: 0,
      approved_minor: 0,
    };
    entry.count += 1;
    if (transaction.status === 'APPROVED') { entry.approved_minor += Number(transaction.amount_minor ?? 0); }
    merchants.set(key, entry);
  }
  const topMerchants = [...merchants.values()].sort((left, right) => right.approved_minor - left.approved_minor).slice(0, 5);

  const reviewFlags: ReviewFlag[] = [];
  for (const transaction of transactions) {
    if (transaction.decline_reason === 'price_hike') {
      reviewFlags.push({
        type: 'price_hike',
        merchant_name: String(transaction.merchant_name),
        transaction_id: String(transaction.id),
        evidence: { amount_minor: transaction.amount_minor, currency: transaction.currency, decline_reason: transaction.decline_reason },
      });
    }
    if (transaction.decline_reason === 'merchant_unknown') {
      reviewFlags.push({
        type: 'unknown_merchant',
        merchant_name: String(transaction.merchant_name),
        transaction_id: String(transaction.id),
        evidence: { amount_minor: transaction.amount_minor, currency: transaction.currency },
      });
    }
  }

  const subscriptions = await db.from('subscriptions')
    .select('id, merchant_name, needs_review, max_amount_minor, amount_minor')
    .eq('user_id', userId)
    .eq('needs_review', true);
  for (const subscription of (subscriptions.data ?? []) as Array<Record<string, unknown>>) {
    reviewFlags.push({
      type: 'rule_review',
      merchant_name: String(subscription.merchant_name ?? ''),
      subscription_id: String(subscription.id),
      evidence: { max_amount_minor: subscription.max_amount_minor, amount_minor: subscription.amount_minor },
    });
  }

  return { month, totals, top_merchants: topMerchants, review_flags: reviewFlags };
}
