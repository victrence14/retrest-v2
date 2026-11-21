import type { SupabaseClient } from '@supabase/supabase-js';
import { recordProductEvent } from './productEvents.js';

// Executes consented recurring contributions once per run window. The
// reference key makes worker retries idempotent.
export async function runDuePoolSchedules(db: SupabaseClient) {
  const due = await db.from('pool_schedules')
    .select('id, pool_id, user_id, amount_minor, currency, next_run_at, status')
    .eq('status', 'ACTIVE')
    .lte('next_run_at', new Date().toISOString())
    .limit(50);
  const results: Array<{ schedule_id: string; reference: string; replayed: boolean }> = [];
  for (const schedule of (due.data ?? []) as Array<Record<string, unknown>>) {
    const reference = `schedule:${String(schedule.id)}:${String(schedule.next_run_at)}`;
    const replay = await db.from('pool_contributions').select('id').eq('pool_id', schedule.pool_id).eq('reference', reference).maybeSingle();
    if (!replay.data) {
      await db.from('pool_contributions').insert({
        pool_id: schedule.pool_id,
        user_id: schedule.user_id,
        amount_minor: schedule.amount_minor,
        currency: schedule.currency,
        reference,
        status: 'SETTLED',
        settled_at: new Date().toISOString(),
      });
    }
    const next = new Date(String(schedule.next_run_at));
    next.setUTCMonth(next.getUTCMonth() + 1);
    await db.from('pool_schedules').update({ next_run_at: next.toISOString(), updated_at: new Date().toISOString() }).eq('id', schedule.id);
    results.push({ schedule_id: String(schedule.id), reference, replayed: Boolean(replay.data) });
  }
  return results;
}

// Reminds members once per run window. product_events makes repeated worker
// passes safe: a reminder is only inserted when its event key is new.
export async function dispatchPoolReminders(db: SupabaseClient, withinDays = 3) {
  const threshold = new Date(Date.now() + withinDays * 86_400_000).toISOString();
  const due = await db.from('pool_schedules')
    .select('id, pool_id, user_id, amount_minor, currency, next_run_at, status')
    .eq('status', 'ACTIVE')
    .lte('next_run_at', threshold);
  const reminders: Array<{ schedule_id: string; created: boolean }> = [];
  for (const schedule of (due.data ?? []) as Array<Record<string, unknown>>) {
    const key = `reminder:${String(schedule.id)}:${String(schedule.next_run_at)}`;
    const event = await recordProductEvent(db, {
      event_key: key,
      event_type: 'POOL_REMINDER',
      payload: {
        schedule_id: schedule.id,
        pool_id: schedule.pool_id,
        user_id: schedule.user_id,
        amount_minor: schedule.amount_minor,
        currency: schedule.currency,
        next_run_at: schedule.next_run_at,
      },
    });
    if (event.status === 'processed') {
      await db.from('notifications').insert({
        user_id: schedule.user_id,
        title: 'Upcoming pool contribution',
        message: `Your next pool contribution of ${String(schedule.amount_minor)} ${String(schedule.currency)} is due soon.`,
      });
    }
    reminders.push({ schedule_id: String(schedule.id), created: event.status === 'processed' });
  }
  return reminders;
}
