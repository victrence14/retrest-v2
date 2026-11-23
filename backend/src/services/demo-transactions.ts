import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Transaction } from "@retrest/shared";
import { page, pageScope, readCursor } from "../lib/pagination.ts";

export interface DemoTransactionFilter {
  limit: number; cursor?: string; from?: string; to?: string; currency?: string; status?: string; business?: boolean;
}
function conditions(userId: string, input: DemoTransactionFilter) {
  const terms = ["t.user_id=?"];
  const values: SQLInputValue[] = [userId];
  if (input.from) { terms.push("t.created_at>=?"); values.push(input.from); }
  if (input.to) { terms.push("t.created_at<?"); values.push(input.to); }
  if (input.currency) { terms.push("t.currency=?"); values.push(input.currency); }
  if (input.status) { terms.push("t.status=?"); values.push(input.status); }
  if (input.business !== undefined) { terms.push("COALESCE(s.is_business_expense,0)=?"); values.push(Number(input.business)); }
  return { terms, values };
}
export function demoTransactionsPage(db: DatabaseSync, userId: string, input: DemoTransactionFilter) {
  const { limit, cursor: rawCursor, ...filters } = input;
  const scope = pageScope(userId, "demo-transactions", filters);
  const cursor = readCursor(rawCursor, scope);
  const { terms, values } = conditions(userId, input);
  if (cursor) {
    terms.push("(t.created_at<? OR (t.created_at=? AND t.id<?))");
    values.push(cursor.created_at, cursor.created_at, cursor.id);
  }
  const rows = db.prepare(`SELECT t.id,t.authorization_id,t.user_id,t.subscription_id,t.merchant_name,t.amount,t.currency,
    t.status,t.decline_reason,t.receipt_url,t.fx_ngn_amount,t.pool_amount,t.created_at,s.is_business_expense
    FROM transaction_logs t LEFT JOIN merchant_subscriptions s ON s.id=t.subscription_id
    WHERE ${terms.join(" AND ")} ORDER BY t.created_at DESC,t.id DESC LIMIT ?`).all(...values, limit + 1) as unknown as Transaction[];
  return page(rows, limit, scope);
}
export function demoPeriodSummary(db: DatabaseSync, userId: string, input: DemoTransactionFilter) {
  const { terms, values } = conditions(userId, input);
  // BigInt read mode prevents silently rounded sums even on long-lived demo databases.
  const statement = db.prepare(`SELECT t.currency,
    COUNT(*) FILTER(WHERE t.status='APPROVED') AS approved_count,
    COUNT(*) FILTER(WHERE t.status<>'APPROVED') AS declined_count,
    COALESCE(SUM(t.amount) FILTER(WHERE t.status='APPROVED'),0) AS amount_minor,
    COALESCE(SUM(t.fx_ngn_amount) FILTER(WHERE t.status='APPROVED'),0) AS fx_ngn_amount_minor
    FROM transaction_logs t LEFT JOIN merchant_subscriptions s ON s.id=t.subscription_id
    WHERE ${terms.join(" AND ")} GROUP BY t.currency ORDER BY t.currency`);
  statement.setReadBigInts(true);
  const rows = statement.all(...values);
  return rows.map(row => ({
    currency: row.currency, approved_count: Number(row.approved_count), declined_count: Number(row.declined_count),
    approved_amount_minor: String(row.amount_minor), fx_ngn_amount_minor: String(row.fx_ngn_amount_minor),
  }));
}
