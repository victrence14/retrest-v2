import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProductEventInput {
  event_key: string;
  event_type: string;
  payload: Record<string, unknown>;
}

// Idempotent event consumption: a retried BE1 event never duplicates work.
export async function recordProductEvent(db: SupabaseClient, event: ProductEventInput) {
  const inserted = await db.from('product_events').insert({
    event_key: event.event_key,
    event_type: event.event_type,
    payload: event.payload,
  }).select('id').single();
  if (inserted.error || !inserted.data) {
    const existing = await db.from('product_events').select('id, processed_at').eq('event_key', event.event_key).maybeSingle();
    return { status: 'duplicate' as const, event: existing.data };
  }
  await db.from('product_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted.data.id);
  return { status: 'processed' as const, event: inserted.data };
}

// Consumes BE1's immutable authorization ledger. Polling keeps the product
// domain decoupled from the issuer webhook; event_key makes replays harmless.
export async function consumeTransactionEvents(db: SupabaseClient, limit = 100) {
  const rows = await db.from('transactions')
    .select('id, user_id, subscription_id, merchant_name, amount_minor, currency, status, decline_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  const transactions = (rows.data ?? []) as Array<Record<string, unknown>>;
  let processed = 0;
  let duplicates = 0;
  for (const transaction of transactions) {
    const result = await recordProductEvent(db, {
      event_key: `txn:${String(transaction.id)}`,
      event_type: transaction.status === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_DECLINED',
      payload: {
        transaction_id: transaction.id,
        user_id: transaction.user_id,
        subscription_id: transaction.subscription_id,
        merchant_name: transaction.merchant_name,
        amount_minor: transaction.amount_minor,
        currency: transaction.currency,
        status: transaction.status,
        decline_reason: transaction.decline_reason,
      },
    });
    if (result.status === 'processed') { processed += 1; } else { duplicates += 1; }
  }
  return { scanned: transactions.length, processed, duplicates };
}
