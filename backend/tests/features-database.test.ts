import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import type { PoolMemberRecord, PoolRecord, SubscriptionRecord, TransactionRecord } from "../src/contracts/features.ts";
import { createTestPostgres } from "./helpers/postgres.ts";
import { identities, postgresClients, resetFeatureFixtures } from "./helpers/supabase.ts";
import { databaseResult } from "../src/lib/database-result.ts";

let pg: PGlite;
let connections: ReturnType<typeof postgresClients>;
before(async () => { pg = await createTestPostgres(); connections = postgresClients(pg); });
beforeEach(async () => { await resetFeatureFixtures(pg); connections.errors.length = 0; });
after(async () => { await pg?.close(); });
const account = () => connections.forIdentity("one");
async function subscription() {
  return databaseResult<SubscriptionRecord>(await account().from("subscriptions").insert({
    user_id: identities.one.id, name: "Music", amount_minor: 101, expected_max_amount: 101, currency: "NGN",
  }).select("*").single());
}
async function pool() {
  const bill = await subscription();
  return databaseResult<{ pool: PoolRecord; members: PoolMemberRecord[] }>(await account().rpc("create_pool", {
    p_subscription_id: bill.id, p_name: "Friends", p_fallback_enabled: true, p_members: [
      { display_name: "One", email: identities.one.email, share_amount: 51 },
      { display_name: "Two", email: identities.two.email, share_amount: 50 },
    ],
  }));
}
async function queuedEmails(count = 1) {
  const summary = databaseResult<{ id: string }>(await account().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  const jobs: Array<{ id: string }> = [];
  for (let i = 0; i < count; i++) jobs.push(databaseResult(await account().rpc("queue_summary_email", {
    p_summary_id: summary.id, p_idempotency_key: "monthly-email-" + i,
  })));
  return jobs;
}

test("RLS denies cross-user edits, ownership transfer, anonymous data access and internal helpers", async () => {
  const saved = await account().from("user_settings").update({ theme: "light" }).eq("user_id", identities.one.id).select("theme").single();
  assert.equal(saved.error, null);
  assert.equal(saved.data.theme, "light");
  const other = await connections.forIdentity("two").from("user_settings").update({ theme: "dark" })
    .eq("user_id", identities.one.id).select("theme");
  assert.deepEqual(other.data, []);
  assert.equal((await account().from("user_settings").update({ user_id: identities.two.id }).select("*")).error?.code, "42501");
  assert.equal((await account().rpc("require_account")).error?.code, "42501");
  await pg.exec("set role anon");
  await assert.rejects(pg.query("select * from public.transactions"), /permission denied/);
  await pg.exec("reset role");
});

test("pool RPC validates ownership and exact integer shares and rolls back invalid creation", async () => {
  const bill = await subscription();
  const input = { p_subscription_id: bill.id, p_name: "Friends", p_fallback_enabled: true, p_members: [
    { display_name: "One", email: identities.one.email, share_amount: 51 },
    { display_name: "Two", email: identities.two.email, share_amount: 49 },
  ] };
  assert.equal((await account().rpc("create_pool", input)).error?.code, "22023");
  assert.equal((await connections.forIdentity("two").rpc("create_pool", input)).error?.code, "P0002");
  assert.equal((await pg.query<{ count: number }>("select count(*)::int as count from public.pools")).rows[0].count, 0);
  const duplicate = { ...input, p_members: [input.p_members[0], { ...input.p_members[1], email: identities.one.email, share_amount: 50 }] };
  assert.equal((await account().rpc("create_pool", duplicate)).error?.code, "22023");
  const fractional = { ...input, p_members: [{ ...input.p_members[0], share_amount: 51.5 }, input.p_members[1]] };
  assert.equal((await account().rpc("create_pool", fractional)).error?.code, "22023");
});

test("concurrent contribution retries persist one pending request; only matching trusted settlement credits funds", async () => {
  const created = await pool();
  const input = { p_pool_id: created.pool.id, p_idempotency_key: "contribution-key" };
  const [first, retry] = await Promise.all([account().rpc("initiate_pool_contribution", input), account().rpc("initiate_pool_contribution", input)]);
  const one = databaseResult<any>(first); const two = databaseResult<any>(retry);
  assert.equal(one.contribution.id, two.contribution.id);
  assert.equal(one.contribution.status, "PENDING");
  assert.deepEqual([one.replayed, two.replayed].sort(), [false, true]);
  assert.equal((await account().rpc("initiate_pool_contribution", { ...input, p_idempotency_key: "different-key" })).error?.code, "23505");
  const event = { p_event_id: "provider-event-1", p_contribution_id: one.contribution.id, p_status: "SETTLED", p_amount_minor: 51, p_currency: "NGN" };
  assert.equal((await account().rpc("record_contribution_event", event)).error?.code, "42501");
  assert.equal((await account().from("pool_contributions").update({ status: "SETTLED" }).select("*")).error?.code, "42501");
  assert.equal((await connections.admin.rpc("record_contribution_event", { ...event, p_amount_minor: 50 })).error?.code, "22023");
  const before = await pg.query<{ balance_minor: number }>("select balance_minor from public.pools where id=$1", [created.pool.id]);
  assert.equal(Number(before.rows[0].balance_minor), 0);
  const settled = databaseResult<any>(await connections.admin.rpc("record_contribution_event", event));
  assert.equal(settled.contribution.status, "SETTLED");
  assert.equal(databaseResult<any>(await connections.admin.rpc("record_contribution_event", event)).replayed, true);
  databaseResult(await connections.admin.rpc("record_contribution_event", { ...event, p_event_id: "another-confirmation" }));
  assert.equal((await connections.admin.rpc("record_contribution_event", { ...event, p_event_id: "bad-transition", p_status: "FAILED" })).error?.code, "P0001");
  const result = await pg.query<{ balance_minor: number; payment_status: string }>(
    "select p.balance_minor,m.payment_status from public.pools p join public.pool_members m on m.pool_id=p.id where p.id=$1 and m.user_id=$2",
    [created.pool.id, identities.one.id]);
  assert.equal(Number(result.rows[0].balance_minor), 51);
  assert.equal(result.rows[0].payment_status, "PAID");
});

test("verified invitee acceptance is idempotent and expiry/revocation deny acceptance", async () => {
  const created = await pool();
  const member = created.members.find(member => member.invited_email === identities.two.email)!;
  const hash = "a".repeat(64);
  const invite = databaseResult<{ id: string }>(await account().rpc("create_pool_invite", {
    p_pool_id: created.pool.id, p_member_id: member.id, p_token_hash: hash, p_expires_at: new Date(Date.now() + 60_000).toISOString(),
  }));
  assert.equal((await connections.forIdentity("agent").rpc("get_pool_invite", { p_token_hash: hash })).error?.code, "P0002");
  assert.equal((await connections.forIdentity("unconfirmed").rpc("accept_pool_invite", { p_token_hash: hash })).error?.code, "42501");
  await pg.query("update public.pool_invites set expires_at=now()-interval '1 second' where id=$1", [invite.id]);
  assert.equal((await connections.forIdentity("two").rpc("accept_pool_invite", { p_token_hash: hash })).error?.code, "P0002");
  await pg.query("update public.pool_invites set expires_at=now()+interval '1 day' where id=$1", [invite.id]);
  const first = databaseResult<any>(await connections.forIdentity("two").rpc("accept_pool_invite", { p_token_hash: hash }));
  const retry = databaseResult<any>(await connections.forIdentity("two").rpc("accept_pool_invite", { p_token_hash: hash }));
  assert.equal(first.member.user_id, identities.two.id);
  assert.equal(first.member.accepted_at, retry.member.accepted_at);
  databaseResult(await account().rpc("revoke_pool_invite", { p_invite_id: invite.id }));
  assert.equal((await connections.forIdentity("two").rpc("get_pool_invite", { p_token_hash: hash })).error?.code, "P0002");
  assert.equal((await connections.forIdentity("two").rpc("initiate_pool_contribution", {
    p_pool_id: created.pool.id, p_idempotency_key: "revoked-member",
  })).error?.code, "P0002");
});

test("payment ledger enforces immutable ownership, valid transitions and event identity", async () => {
  const bill = await subscription();
  const payload = { user_id: identities.one.id, subscription_id: bill.id, provider_transaction_id: "payment-1",
    merchant_name: "Music", amount_minor: 101, currency: "NGN", status: "PENDING", is_business_expense: true };
  assert.equal((await account().rpc("record_payment_event", { p_event_id: "one", p_payload: payload })).error?.code, "42501");
  const pending = databaseResult<{ transaction: TransactionRecord }>(await connections.admin.rpc("record_payment_event", { p_event_id: "one", p_payload: payload }));
  assert.equal(pending.transaction.settled_at, null);
  assert.equal((await connections.admin.rpc("record_payment_event", { p_event_id: "wrong-owner-new-payment", p_payload: {
    ...payload, provider_transaction_id: "cross-owner-payment", user_id: identities.two.id,
  } })).error?.code, "23503");
  assert.equal((await connections.admin.rpc("record_payment_event", { p_event_id: "two", p_payload: { ...payload, user_id: identities.two.id } })).error?.code, "22023");
  const settledPayload = { ...payload, status: "SETTLED" };
  const settled = databaseResult<any>(await connections.admin.rpc("record_payment_event", { p_event_id: "settled", p_payload: settledPayload }));
  assert.ok(settled.transaction.settled_at);
  assert.equal(databaseResult<any>(await connections.admin.rpc("record_payment_event", { p_event_id: "settled", p_payload: settledPayload })).replayed, true);
  assert.equal((await connections.admin.rpc("record_payment_event", { p_event_id: "settled", p_payload: { ...settledPayload, amount_minor: 102 } })).error?.code, "22023");
  databaseResult(await account().from("subscriptions").update({ is_business_expense: false }).eq("id", bill.id).select("*"));
  const history = databaseResult<any[]>(await account().from("transactions").select("is_business_expense"));
  assert.equal(history[0].is_business_expense, true, "classification is a payment snapshot");
  databaseResult(await connections.admin.rpc("record_payment_event", { p_event_id: "reversed", p_payload: { ...payload, status: "REVERSED" } }));
  assert.equal((await connections.admin.rpc("record_payment_event", { p_event_id: "late-settlement", p_payload: settledPayload })).error?.code, "P0001");
});

test("aggregate amounts remain exact beyond JavaScript's safe integer range", async () => {
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    values ($1,'huge-1','Large',9007199254740991,'NGN','SETTLED',true,'2026-11-01Z',now()),
      ($1,'huge-2','Large',9007199254740991,'NGN','SETTLED',true,'2026-11-01Z',now())`, [identities.one.id]);
  const totals = databaseResult<any[]>(await account().rpc("transaction_summary", {
    p_from: "2026-11-01T00:00:00Z", p_to: "2026-12-01T00:00:00Z", p_business: true,
  }));
  assert.equal(totals[0].settled_amount_minor, (9007199254740991n * 2n).toString());
  assert.equal(totals[0].settled_count, 2);
});

test("monthly summaries remain immutable while complete live totals include late settlements", async () => {
  const first = databaseResult<any>(await account().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  assert.deepEqual(first.totals, []);
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    values($1,'late-payment','Late settlement',101,'NGN','SETTLED',true,'2026-11-01T00:00:00Z',now())`, [identities.one.id]);
  const retry = databaseResult<any>(await account().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  assert.equal(retry.id, first.id);
  assert.deepEqual(retry.totals, []);
  const live = databaseResult<any[]>(await account().rpc("transaction_summary", { p_from: "2026-11-01T00:00:00Z", p_to: "2026-12-01T00:00:00Z" }));
  assert.equal(live[0].settled_amount_minor, "101");
});

test("device removal revokes the signed session in RLS even if no device header is supplied", async () => {
  const device = databaseResult<any>(await account().rpc("register_device", {
    p_name: "Laptop", p_token_hash: "b".repeat(64), p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  }));
  assert.equal((await account().from("devices").select("token_hash")).error?.code, "42501");
  assert.equal((await connections.forIdentity("two").rpc("revoke_device", { p_device_id: device.id })).error?.code, "P0002");
  databaseResult(await account().rpc("revoke_device", { p_device_id: device.id }));
  assert.equal(databaseResult(await account().rpc("is_account_session_active")), false);
  assert.deepEqual(databaseResult(await account().from("user_settings").select("theme")), []);
  assert.equal((await account().rpc("register_device", {
    p_name: "Forged restoration", p_token_hash: "c".repeat(64), p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })).error?.code, "42501");
  assert.equal(databaseResult(await connections.forIdentity("oneNewSession").rpc("is_account_session_active")), true);
  assert.equal(databaseResult(await connections.forIdentity("two").rpc("is_account_session_active")), true);
});

test("email workers claim disjoint batches; expired leases fence out stale workers", async () => {
  await queuedEmails(5);
  const [first, second] = await Promise.all([
    connections.admin.rpc("claim_email_jobs", { p_limit: 3, p_lease_seconds: 120 }),
    connections.admin.rpc("claim_email_jobs", { p_limit: 3, p_lease_seconds: 120 }),
  ]);
  const jobs = [...databaseResult<any[]>(first), ...databaseResult<any[]>(second)];
  assert.equal(jobs.length, 5);
  assert.equal(new Set(jobs.map(job => job.id)).size, 5);
  const job = jobs[0];
  await pg.query("update public.email_jobs set locked_until=now()-interval '1 second' where id=$1", [job.id]);
  const reclaimed = databaseResult<any[]>(await connections.admin.rpc("claim_email_jobs", { p_limit: 1, p_lease_seconds: 120 }))[0];
  assert.notEqual(reclaimed.claim_token, job.claim_token);
  assert.equal(databaseResult(await connections.admin.rpc("finish_email_job", {
    p_job_id: job.id, p_claim_token: job.claim_token, p_provider_message_id: "stale-provider-id",
  })), false);
  assert.equal((await account().rpc("claim_email_jobs")).error?.code, "42501");
});

test("signed delivery events arriving before acceptance are retained and never downgraded", async () => {
  await queuedEmails();
  const job = databaseResult<any[]>(await connections.admin.rpc("claim_email_jobs"))[0];
  const event = { p_event_id: "delivered-event", p_provider_message_id: "resend-message", p_status: "DELIVERED", p_payload_hash: "d".repeat(64) };
  databaseResult(await connections.admin.rpc("record_email_event", event));
  databaseResult(await connections.admin.rpc("finish_email_job", { p_job_id: job.id, p_claim_token: job.claim_token, p_provider_message_id: "resend-message" }));
  assert.equal(databaseResult<any>(await account().from("email_jobs").select("status").eq("id", job.id).single()).status, "DELIVERED");
  databaseResult(await connections.admin.rpc("record_email_event", { ...event, p_event_id: "bounce-event", p_status: "BOUNCED" }));
  databaseResult(await connections.admin.rpc("record_email_event", { ...event, p_event_id: "late-delivered" }));
  assert.equal(databaseResult<any>(await account().from("email_jobs").select("status").eq("id", job.id).single()).status, "BOUNCED");
  assert.equal((await connections.admin.rpc("record_email_event", { ...event, p_payload_hash: "e".repeat(64) })).error?.code, "22023");
});
