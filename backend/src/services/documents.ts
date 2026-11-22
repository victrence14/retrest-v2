import type { SupabaseClient } from '@supabase/supabase-js';

export const receiptSelect = 'id, authorization_id, user_id, subscription_id, merchant_name, amount_minor, currency, status, decline_reason, receipt_url, fx_ngn_amount, pool_amount, http_status, response_json, created_at';

export interface ReceiptSnapshot {
  receipt_id: string;
  authorization_id: string;
  merchant_name: string;
  amount_minor: number;
  currency: string;
  status: string;
  decline_reason: string | null;
  fx_ngn_amount: number;
  pool_amount: number;
  settled_at: string;
  receipt_url: string | null;
  issuer_response: unknown;
}

export async function buildReceipt(db: SupabaseClient, userId: string, transactionId: string): Promise<ReceiptSnapshot | null> {
  const row = await db.from('transactions').select(receiptSelect).eq('id', transactionId).eq('user_id', userId).maybeSingle();
  const transaction = row.data as Record<string, unknown> | null;
  if (!transaction) { return null; }
  return {
    receipt_id: String(transaction.id),
    authorization_id: String(transaction.authorization_id),
    merchant_name: String(transaction.merchant_name),
    amount_minor: Number(transaction.amount_minor),
    currency: String(transaction.currency),
    status: String(transaction.status),
    decline_reason: transaction.decline_reason ? String(transaction.decline_reason) : null,
    fx_ngn_amount: Number(transaction.fx_ngn_amount ?? 0),
    pool_amount: Number(transaction.pool_amount ?? 0),
    settled_at: String(transaction.created_at),
    receipt_url: transaction.receipt_url ? String(transaction.receipt_url) : null,
    issuer_response: transaction.response_json ?? null,
  };
}

export function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection before quoting.
  if (/^[=+\-@\t\r]/.test(text)) { text = `'${text}`; }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const exportHeaders = ['id', 'authorization_id', 'merchant_name', 'amount_minor', 'currency', 'status', 'decline_reason', 'fx_ngn_amount', 'pool_amount', 'created_at'];

export function transactionsToCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [exportHeaders.join(',')];
  for (const row of rows) {
    lines.push(exportHeaders.map((header) => csvEscape(row[header])).join(','));
  }
  return lines.join('\n');
}

export interface CurrencyTotal {
  currency: string;
  approved_minor: number;
  declined_minor: number;
  count: number;
}

export function totalsByCurrency(rows: Array<Record<string, unknown>>): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const row of rows) {
    const currency = String(row.currency ?? 'NGN');
    const total = totals.get(currency) ?? { currency, approved_minor: 0, declined_minor: 0, count: 0 };
    const amount = Number(row.amount_minor ?? 0);
    if (row.status === 'APPROVED') { total.approved_minor += amount; } else { total.declined_minor += amount; }
    total.count += 1;
    totals.set(currency, total);
  }
  return [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}
