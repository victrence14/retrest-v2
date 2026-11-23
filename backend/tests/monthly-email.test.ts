import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { createTestPostgres } from "./helpers/postgres.ts";
import { identities, postgresClients, resetFeatureFixtures } from "./helpers/supabase.ts";
import { databaseResult } from "../src/lib/database-result.ts";

let pg: PGlite;
let connections: ReturnType<typeof postgresClients>;
before(async () => { pg = await createTestPostgres(); connections = postgresClients(pg); });
beforeEach(async () => { await resetFeatureFixtures(pg); });
after(async () => { await pg?.close(); });
const schedule = (limit = 100) => connections.admin.rpc("schedule_monthly_summary_emails", { p_now: "2026-12-01T00:00:00Z", p_limit: limit });
const one = () => connections.forIdentity("one");
async function optIn(id = identities.one.id, value = true) {
  await pg.query("update public.user_settings set monthly_summary_email=$2 where user_id=$1", [id, value]);
}

test("the monthly scheduler queues verified opted-in accounts once with exact UTC totals", async () => {
  await optIn(); await optIn(identities.unconfirmed.id);
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    values($1,'nov-1','Music',9007199254740991,'NGN','SETTLED',false,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
      ($1,'nov-2','Music',9007199254740991,'NGN','SETTLED',false,'2026-11-30T23:59:59.999999Z','2026-11-30T23:59:59.999999Z'),
      ($1,'pending','Music',100,'USD','PENDING',false,'2026-11-15T00:00:00Z',null),
      ($1,'dec','Music',700,'NGN','SETTLED',false,'2026-12-01T00:00:00Z','2026-12-01T00:00:00Z'),
      ($2,'other','Music',800,'NGN','SETTLED',false,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')`, [identities.one.id, identities.two.id]);
  assert.equal(databaseResult(await schedule()), 1);
  assert.equal(databaseResult(await schedule()), 0);
  const jobs = await pg.query<{ recipient: string; payload: any }>("select recipient,payload from public.email_jobs");
  assert.equal(jobs.rows.length, 1); assert.equal(jobs.rows[0].recipient, identities.one.email);
  assert.equal(jobs.rows[0].payload.month, "2026-11");
  assert.equal(jobs.rows[0].payload.totals[0].settled_amount_minor, (9007199254740991n * 2n).toString());
  assert.equal(jobs.rows[0].payload.totals[0].settled_count, 2);
  assert.equal(jobs.rows[0].payload.totals[1].pending_count, 1);
});

test("bounded concurrent scheduler batches preserve existing immutable snapshots", async () => {
  await optIn(); await optIn(identities.two.id);
  const saved = databaseResult<any>(await one().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    values($1,'late','Music',100,'NGN','SETTLED',false,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')`, [identities.one.id]);
  const results = await Promise.all([schedule(1), schedule(1), schedule(1)]);
  assert.equal(results.reduce((total, result) => total + databaseResult<number>(result), 0), 2);
  const snapshot = await pg.query<{ summary_id: string; payload: any }>("select summary_id,payload from public.email_jobs where user_id=$1", [identities.one.id]);
  assert.equal(snapshot.rows[0].summary_id, saved.id); assert.deepEqual(snapshot.rows[0].payload.totals, []);
});

test("scheduler and cross-account aggregation are restricted to trusted execution", async () => {
  assert.equal((await one().rpc("schedule_monthly_summary_emails", { p_now: "2026-12-01Z", p_limit: 1 })).error?.code, "42501");
  assert.equal((await one().rpc("account_transaction_totals", { p_user_id: identities.two.id, p_from: "2026-11-01Z", p_to: "2026-12-01Z" })).error?.code, "42501");
  assert.equal((await schedule(0)).error?.code, "22023");
  assert.equal((await schedule(101)).error?.code, "22023");
  assert.equal((await connections.admin.rpc("schedule_monthly_summary_emails", { p_limit: null })).error?.code, "22023");
  assert.equal((await connections.admin.rpc("claim_email_jobs", { p_limit: null })).error?.code, "22023");
  const saved = databaseResult<any>(await one().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  assert.equal((await one().rpc("queue_summary_email", { p_summary_id: saved.id, p_idempotency_key: "scheduled-summary-2026-11" })).error?.code, "22023");
});

test("opting out cancels automatic jobs before a send while retaining explicit email requests", async () => {
  await optIn(); databaseResult(await schedule());
  const saved = databaseResult<any>(await one().rpc("generate_monthly_summary", { p_month: "2026-11" }));
  const manual = databaseResult<any>(await one().rpc("queue_summary_email", { p_summary_id: saved.id, p_idempotency_key: "manual-email-key" }));
  await optIn(identities.one.id, false);
  const claimed = databaseResult<any[]>(await connections.admin.rpc("claim_email_jobs"));
  assert.equal(claimed.length, 1); assert.equal(claimed[0].id, manual.id);
  const automatic = await pg.query<{ status: string; last_error_code: string }>("select status,last_error_code from public.email_jobs where idempotency_key like 'scheduled-summary-%'");
  assert.equal(automatic.rows[0].status, "FAILED"); assert.equal(automatic.rows[0].last_error_code, "monthly_email_disabled");
});

test("a confirmed email change cancels queued automatic delivery to the old address", async () => {
  await optIn(); databaseResult(await schedule());
  await pg.query("update auth.users set email='changed@example.test' where id=$1", [identities.one.id]);
  assert.deepEqual(databaseResult(await connections.admin.rpc("claim_email_jobs")), []);
  const jobs = await pg.query<{ status: string }>("select status from public.email_jobs");
  assert.equal(jobs.rows[0].status, "FAILED");
  assert.equal(databaseResult(await schedule()), 0);
});
