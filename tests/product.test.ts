import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSubscriptionSchema, updateSubscriptionSchema } from '../backend/src/services/subscriptions.js';
import {
  acceptInvite,
  contributionSchema,
  createContribution,
  createPool,
  createPoolSchema,
  getInvite,
  poolMemberInputSchema,
  updatePoolSchema,
} from '../backend/src/services/pools.js';
import { csvEscape, totalsByCurrency, transactionsToCsv } from '../backend/src/services/documents.js';
import { monthRange } from '../backend/src/services/insights.js';
import { PRODUCT_CONFIG } from '../backend/src/product-config.js';
import { dispatchPoolReminders, runDuePoolSchedules } from '../backend/src/jobs/poolSchedules.js';
import { consumeTransactionEvents, recordProductEvent } from '../backend/src/jobs/productEvents.js';

const subscription = {
  merchant_name: 'Spotify',
  merchant_descriptor: 'SPOTIFY',
  expected_amount_minor: 500000,
  currency: 'NGN' as const,
  next_billing_date: '2026-12-01',
};

const pool = {
  subscription_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Family music',
  target_amount: 100000,
  currency: 'NGN' as const,
  members: [
    { name: 'Host', email: 'host@example.test', share_amount: 50000 },
    { name: 'Member', email: 'member@example.test', share_amount: 50000 },
  ],
};

interface FakeResult {
  data?: unknown;
  error?: unknown;
  single?: FakeResult;
  maybeSingle?: FakeResult;
}

// Minimal chainable Supabase double. Terminal helpers can be overridden per
// operation so conflict/retry paths are exercised, not just the happy path.
function fakeClient(tables: Record<string, FakeResult>, rpc: FakeResult = { data: null, error: null }) {
  const calls: Array<{ table: string; op: string }> = [];
  const client = {
    calls,
    from(table: string) {
      const result = tables[table] ?? { data: null, error: null };
      const builder: any = {};
      for (const op of ['select', 'eq', 'in', 'order', 'limit', 'lte', 'gte', 'insert', 'update', 'delete', 'upsert']) {
        builder[op] = () => { calls.push({ table, op }); return builder; };
      }
      builder.single = async () => result.single ?? result;
      builder.maybeSingle = async () => result.maybeSingle ?? result;
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: result.data ?? [], error: result.error ?? null });
      return builder;
    },
    rpc: async () => rpc,
  };
  return client;
}

function asClient(client: ReturnType<typeof fakeClient>): SupabaseClient {
  return client as unknown as SupabaseClient;
}

test('merchant rules reject owner injection, bad amounts and bad dates', () => {
  assert.equal(createSubscriptionSchema.safeParse(subscription).success, true);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, user_id: 'attacker' }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, expected_amount_minor: 500000.5 }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, expected_amount_minor: 0 }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, max_amount_minor: -1 }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, next_billing_date: '01/12/2026' }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, merchant_descriptor: 'spotify' }).success, false);
  assert.equal(createSubscriptionSchema.safeParse({ ...subscription, currency: 'EUR' }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ user_id: 'attacker' }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({}).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ status: 'CANCELLED' }).success, false);
  assert.equal(updateSubscriptionSchema.safeParse({ status: 'PAUSED', max_amount_minor: 750000 }).success, true);
});

test('pool payloads require positive integer shares and reject ownership fields', () => {
  assert.equal(createPoolSchema.safeParse(pool).success, true);
  assert.equal(createPoolSchema.safeParse({ ...pool, members: [] }).success, false);
  assert.equal(createPoolSchema.safeParse({ ...pool, host_user_id: 'attacker' }).success, false);
  assert.equal(createPoolSchema.safeParse({ ...pool, target_amount: 0 }).success, false);
  assert.equal(createPoolSchema.safeParse({ ...pool, invite_expires_in_days: 0 }).success, false);
  assert.equal(poolMemberInputSchema.safeParse({ name: 'A', email: 'not-an-email', share_amount: 1 }).success, false);
  assert.equal(poolMemberInputSchema.safeParse({ name: 'A', email: 'a@example.test', share_amount: 1.5 }).success, false);
  assert.equal(updatePoolSchema.safeParse({ invite_revoked: true }).success, true);
  assert.equal(updatePoolSchema.safeParse({}).success, false);
  assert.equal(updatePoolSchema.safeParse({ pool_balance: 1 }).success, false);
  assert.equal(contributionSchema.safeParse({ amount_minor: 25000, currency: 'NGN', reference: 'ref-1' }).success, true);
  assert.equal(contributionSchema.safeParse({ amount_minor: 25000, currency: 'NGN', reference: '' }).success, false);
  assert.equal(contributionSchema.safeParse({ amount_minor: 0, currency: 'NGN', reference: 'ref-1' }).success, false);
});

test('pool service rejects shares that do not equal the target and duplicate emails', async () => {
  const setup = () => fakeClient({ subscriptions: { data: { id: 's1' } }, split_pools: { data: null } });

  const wrongShares = await createPool(asClient(setup()), 'u1', { ...pool, target_amount: 99999 });
  assert.equal(wrongShares.status, 'invalid_shares');

  const duplicateEmails = await createPool(asClient(setup()), 'u1', {
    ...pool,
    members: [
      { name: 'A', email: 'same@example.test', share_amount: 50000 },
      { name: 'B', email: 'SAME@example.test', share_amount: 50000 },
    ],
  });
  assert.equal(duplicateEmails.status, 'invalid_members');
});

test('contribution replay never inserts or settles twice', async () => {
  const client = fakeClient({
    split_pools: { data: { id: 'p1', host_user_id: 'u1', pool_balance: 0, target_amount: 1000 } },
    pool_members: { data: [] },
    pool_contributions: { data: { id: 'c1', reference: 'ref-1' } },
  });
  const result = await createContribution(asClient(client), 'u1', 'p1', { amount_minor: 500, currency: 'NGN', reference: 'ref-1' });
  assert.equal(result.status, 'replayed');
  assert.equal(client.calls.filter((call) => call.table === 'pool_contributions' && call.op === 'insert').length, 0);
});

test('worker retries do not duplicate scheduled contributions', async () => {
  const schedule = { id: 's1', pool_id: 'p1', user_id: 'u1', amount_minor: 100, currency: 'NGN', next_run_at: '2026-11-01T00:00:00.000Z', status: 'ACTIVE' };
  const client = fakeClient({
    pool_schedules: { data: [schedule] },
    pool_contributions: { data: { id: 'c1' } },
  });
  const results = await runDuePoolSchedules(asClient(client));
  assert.equal(results.length, 1);
  assert.equal(results[0]?.replayed, true);
  assert.equal(client.calls.filter((call) => call.table === 'pool_contributions' && call.op === 'insert').length, 0);
});

test('payment events and reminders are idempotent across worker passes', async () => {
  const firstRun = fakeClient({
    transactions: { data: [{ id: 't1', user_id: 'u1', subscription_id: 's1', merchant_name: 'Spotify', amount_minor: 100, currency: 'NGN', status: 'APPROVED', decline_reason: null }] },
    product_events: { single: { data: { id: 'e1' } } },
  });
  const consumed = await consumeTransactionEvents(asClient(firstRun));
  assert.deepEqual(consumed, { scanned: 1, processed: 1, duplicates: 0 });

  const duplicateEvent = await recordProductEvent(asClient(fakeClient({
    product_events: {
      single: { data: null, error: { code: '23505' } },
      maybeSingle: { data: { id: 'e1', processed_at: null } },
    },
  })), { event_key: 'txn:t1', event_type: 'PAYMENT_APPROVED', payload: {} });
  assert.equal(duplicateEvent.status, 'duplicate');

  const schedule = { id: 's1', pool_id: 'p1', user_id: 'u1', amount_minor: 100, currency: 'NGN', next_run_at: '2026-11-22T00:00:00.000Z', status: 'ACTIVE' };
  const firstReminder = fakeClient({ pool_schedules: { data: [schedule] }, product_events: { single: { data: { id: 'e2' } } } });
  const created = await dispatchPoolReminders(asClient(firstReminder));
  assert.equal(created[0]?.created, true);
  assert.equal(firstReminder.calls.filter((call) => call.table === 'notifications' && call.op === 'insert').length, 1);

  const retriedReminder = fakeClient({
    pool_schedules: { data: [schedule] },
    product_events: {
      single: { data: null, error: { code: '23505' } },
      maybeSingle: { data: { id: 'e2', processed_at: null } },
    },
  });
  const replayed = await dispatchPoolReminders(asClient(retriedReminder));
  assert.equal(replayed[0]?.created, false);
  assert.equal(retriedReminder.calls.filter((call) => call.table === 'notifications' && call.op === 'insert').length, 0);
});

test('CSV output escapes untrusted values and neutralises formulas', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('line\nbreak'), '"line\nbreak"');
  assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvEscape('@cmd'), "'@cmd");
  assert.equal(csvEscape(null), '');

  const csv = transactionsToCsv([
    { id: 't1', merchant_name: 'Evil, Inc', amount_minor: 100, currency: 'NGN', status: 'APPROVED' },
    { id: 't2', merchant_name: '=HYPERLINK("x")', amount_minor: 200, currency: 'USD', status: 'DECLINED' },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0] ?? '', /^id,authorization_id,merchant_name/);
  assert.match(lines[1] ?? '', /"Evil, Inc"/);
  assert.match(lines[2] ?? '', /"'=HYPERLINK\(""x""\)"/);
});

test('totals keep currencies separate and cover the whole period', () => {
  const totals = totalsByCurrency([
    { currency: 'NGN', amount_minor: 1000, status: 'APPROVED' },
    { currency: 'NGN', amount_minor: 250, status: 'DECLINED_KILL_SWITCH' },
    { currency: 'USD', amount_minor: 900, status: 'APPROVED' },
  ]);
  assert.deepEqual(totals, [
    { currency: 'NGN', approved_minor: 1000, declined_minor: 250, count: 2 },
    { currency: 'USD', approved_minor: 900, declined_minor: 0, count: 1 },
  ]);
  assert.deepEqual(monthRange('2026-11'), { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' });
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' });
});

test('invitations expose validity and map every acceptance failure', async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const base = { pool_id: 'p1', name: 'Family music', target_amount: 100000, currency: 'NGN', status: 'ACTIVE', revoked_at: null };

  const valid = await getInvite(asClient(fakeClient({}, { data: [{ ...base, expires_at: future }], error: null })), 'token');
  assert.equal(valid?.valid, true);
  assert.equal(valid?.expired, false);

  const expired = await getInvite(asClient(fakeClient({}, { data: [{ ...base, expires_at: past }], error: null })), 'token');
  assert.equal(expired?.valid, false);
  assert.equal(expired?.expired, true);

  const revoked = await getInvite(asClient(fakeClient({}, { data: [{ ...base, expires_at: future, revoked_at: past }], error: null })), 'token');
  assert.equal(revoked?.revoked, true);

  const missing = await getInvite(asClient(fakeClient({}, { data: [], error: null })), 'token');
  assert.equal(missing, null);

  const mapping: Array<[string, string]> = [
    ['invite_not_found', 'not_found'],
    ['invite_revoked', 'revoked'],
    ['invite_expired', 'expired'],
    ['invite_email_mismatch', 'email_mismatch'],
    ['invite_already_claimed', 'claimed'],
    ['something_else', 'error'],
  ];
  for (const [message, expected] of mapping) {
    const result = await acceptInvite(asClient(fakeClient({}, { data: null, error: { message } })), 'token');
    assert.equal(result.status, expected);
  }

  const accepted = await acceptInvite(
    asClient(fakeClient({}, { data: [{ pool_id: 'p1', member_id: 'm1', share_amount: 50000, payment_status: 'PENDING' }], error: null })),
    'token',
  );
  assert.equal(accepted.status, 'accepted');
  assert.deepEqual(accepted.membership, { pool_id: 'p1', member_id: 'm1', share_amount: 50000, payment_status: 'PENDING' });
});

test('device challenges have a bounded lifetime and attempt budget', () => {
  assert.ok(PRODUCT_CONFIG.deviceChallengeTtlMs > 0);
  assert.ok(PRODUCT_CONFIG.deviceChallengeMaxAttempts > 0);
  assert.ok(PRODUCT_CONFIG.exportMaxRows > 0);
});
