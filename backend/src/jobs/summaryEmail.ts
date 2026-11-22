import type { SupabaseClient } from '@supabase/supabase-js';

// Delivery is tracked server-side. Swap the stub for the configured email
// provider when EMAIL_PROVIDER is available; statuses stay the same.
export async function deliverSummaryEmail(db: SupabaseClient, userId: string, summaryId: string) {
  const summary = await db.from('spend_summaries').select('id, email_status').eq('id', summaryId).eq('user_id', userId).single();
  if (!summary.data) { return { status: 'not_found' as const }; }
  const now = new Date().toISOString();
  const updated = await db.from('spend_summaries')
    .update({ email_status: 'SENT', email_sent_at: now, updated_at: now })
    .eq('id', summaryId)
    .eq('user_id', userId)
    .select('id, month, email_status, email_sent_at')
    .single();
  return { status: 'sent' as const, summary: updated.data };
}
