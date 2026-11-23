import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodSummary, TransactionRecord } from "../contracts/features.ts";
import { databaseResult } from "../lib/database-result.ts";
import { monthRange, transactionRange, type TransactionQuery } from "../lib/feature-validation.ts";
import { page, pageScope, readCursor } from "../lib/pagination.ts";

export const TRANSACTION_COLUMNS = "id,user_id,subscription_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,fx_ngn_amount,pool_amount,decline_reason,created_at,settled_at,updated_at";

export async function transactionsPage(db: SupabaseClient, userId: string, input: TransactionQuery) {
  const { from, to } = transactionRange(input);
  const filters = { from, to, currency: input.currency, status: input.status, business: input.business, subscription_id: input.subscription_id };
  const scope = pageScope(userId, "transactions", filters);
  const cursor = readCursor(input.cursor, scope);
  let query = db.from("transactions").select(TRANSACTION_COLUMNS).eq("user_id", userId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  if (input.currency) query = query.eq("currency", input.currency);
  if (input.status) query = query.eq("status", input.status);
  if (input.business !== undefined) query = query.eq("is_business_expense", input.business);
  if (input.subscription_id) query = query.eq("subscription_id", input.subscription_id);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const rows = databaseResult<TransactionRecord[]>(await query
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1));
  return page(rows.map(row => ({ ...row, receipt_url: row.status === "SETTLED" ? `/api/v1/receipts/${row.id}` : null })), input.limit, scope);
}
export async function periodSummary(db: SupabaseClient, from: string, to: string, business?: boolean): Promise<PeriodSummary> {
  return { from, to, totals: databaseResult(await db.rpc("transaction_summary", { p_from: from, p_to: to, p_business: business ?? null })) };
}
/** Traverse every page, including beyond PostgREST's response cap. Memory stays bounded. */
export async function* businessTransactions(db: SupabaseClient, userId: string, month: string): AsyncGenerator<TransactionRecord> {
  let cursor: string | undefined;
  do {
    const result = await transactionsPage(db, userId, { ...monthRange(month), limit: 100, cursor, status: "SETTLED", business: true });
    yield* result.data;
    cursor = result.next_cursor ?? undefined;
  } while (cursor);
}
