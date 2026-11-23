import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import type { AuthGateway } from "../src/services/auth-gateway.ts";
import { HttpError } from "../src/lib/http.ts";
import { runEmailBatch, EmailProviderError } from "../src/services/email.ts";
import { createTestPostgres } from "./helpers/postgres.ts";
import { identities, postgresClients, resetFeatureFixtures } from "./helpers/supabase.ts";

let pg: PGlite;
let connections: ReturnType<typeof postgresClients>;
before(async () => { pg = await createTestPostgres(); connections = postgresClients(pg); });
beforeEach(async () => { await resetFeatureFixtures(pg); connections.errors.length = 0; });
after(async () => { await pg?.close(); });
const config: Config = {
  nodeEnv: "test", port: 3001, databasePath: ":memory:", demoEnabled: false,
  sessionSecret: "session-secret", corsOrigins: ["http://localhost:3000"],
  supabase: { url: "https://example.supabase.co", anonKey: "test-anon-key" },
  settlementWebhookSecret: "settlement-secret-with-at-least-32-characters",
  email: { provider: "resend", apiKey: "test-key", from: "receipts@example.test", webhookSecret: "whsec_" + Buffer.from("email-webhook-secret").toString("base64") },
};
const tokenPayload = { access_token: "one", refresh_token: "refresh-one", expires_in: 3600, token_type: "bearer",
  user: { id: identities.one.id, email: identities.one.email, email_confirmed_at: "2026-01-01T00:00:00Z" } };
type Api = (path: string, method?: string, body?: object, identity?: string | null, headers?: Record<string, string>) => Promise<Response>;
async function withApi(run: (api: Api, url: string) => Promise<void>, options: { config?: Partial<Config>; gateway?: AuthGateway } = {}) {
  const app = createApp({ ...config, ...options.config }, {
    supabase: connections.clients, admin: connections.admin,
    authGateway: options.gateway ?? { async request() { return tokenPayload; } },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api: Api = (path, method = "GET", body, identity = "one", headers = {}) => fetch(url + (path.startsWith("/api/") ? path : "/api/v1" + path), {
    method, headers: { ...(identity ? { Authorization: "Bearer " + identity } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try { await run(api, url); }
  finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    app.locals.close();
  }
}
async function json(response: Response, status = 200): Promise<any> {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify({ body, sql: connections.errors.at(-1) }));
  return body;
}
async function createSubscription(api: Api, overrides: object = {}, identity = "one") {
  return (await json(await api("/subscriptions", "POST", {
    name: "Music", merchant_descriptor: "MUSIC", amount_minor: 101, currency: "NGN",
    next_billing_date: "2026-12-01", is_business_expense: true, ...overrides,
  }, identity), 201)).subscription;
}
async function createPool(api: Api) {
  const subscription = await createSubscription(api);
  return json(await api("/pools", "POST", { subscription_id: subscription.id, name: "Friends", members: [
    { display_name: "One", email: identities.one.email, share_amount: 51 },
    { display_name: "Two", email: identities.two.email, share_amount: 50 },
  ] }), 201);
}
function signedHeaders(body: string, secret = config.settlementWebhookSecret!, timestamp = String(Math.floor(Date.now() / 1000))) {
  return { "Content-Type": "application/json", "x-retrest-timestamp": timestamp,
    "x-retrest-signature": createHmac("sha256", secret).update(timestamp + "." + body).digest("hex") };
}

test("health/readiness are public; verified account routes reject cookies, invalid JWTs and unconfirmed accounts", async () => {
  await withApi(async api => {
    assert.equal((await api("/api/health", "GET", undefined, null)).status, 200);
    assert.equal((await api("/api/ready", "GET", undefined, null)).status, 200);
    for (const token of [null, "expired", "spoofed.jwt.payload", "__proto__"])
      assert.equal((await api("/settings", "GET", undefined, token)).status, 401);
    assert.equal((await api("/settings", "GET", undefined, "unconfirmed")).status, 403);
    const me = await json(await api("/me"));
    assert.equal(me.user.id, identities.one.id);
    assert.equal((await api("/api/bootstrap")).status, 401);
    assert.equal((await api("/api/state")).status, 401);
    assert.equal((await api("/unknown-account-endpoint")).status, 404);
  });
  await withApi(async api => {
    const session = await api("/api/session", "POST", {}, null);
    const cookie = session.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await api("/settings", "GET", undefined, null, { Cookie: cookie })).status, 401);
    assert.equal((await api("/api/settings", "PATCH", { auto_fx_enabled: false }, null, {
      Cookie: cookie, Origin: "https://evil.example", "X-Forwarded-Host": "evil.example",
    })).status, 403);
  }, { config: { demoEnabled: true } });
});

test("readiness rejects a database missing the scheduling migration while liveness remains available", async () => {
  try {
    await pg.exec(`create or replace function public.backend_readiness()
      returns text language sql immutable set search_path = '' as $$ select '20261122020000'::text $$;`);
    await withApi(async api => {
      assert.equal((await api("/api/health", "GET", undefined, null)).status, 200);
      const readiness = await api("/api/ready", "GET", undefined, null);
      assert.equal(readiness.status, 503);
      assert.deepEqual(await readiness.json(), { error: "Account database upgrade required." });
    });
  } finally {
    await pg.exec(`create or replace function public.backend_readiness()
      returns text language sql immutable set search_path = '' as $$ select '20261123000000'::text $$;`);
  }
});

test("authentication routes validate credentials, forward confirmation/recovery flows and revoke refreshed sessions after logout", async () => {
  const calls: Array<{ method: string; path: string; body?: object; token?: string }> = [];
  const gateway: AuthGateway = { async request(method, path, body, token) {
    calls.push({ method, path, body, token });
    if (path.startsWith("recover")) throw new HttpError(400, "provider account lookup");
    if (path === "verify" && (body as { type?: string }).type === "email_change") return {};
    return tokenPayload;
  } };
  await withApi(async api => {
    assert.equal((await api("/api/auth/signup", "POST", { email: identities.one.email, password: "short", display_name: "One" }, null)).status, 400);
    assert.equal((await api("/api/auth/signup", "POST", { email: identities.one.email, password: "long-enough-password", display_name: "One", user_id: identities.two.id }, null)).status, 400);
    assert.equal((await api("/api/auth/signup", "POST", { email: identities.one.email, password: "long-enough-password", display_name: "One" }, null)).status, 202);
    const login = await json(await api("/api/auth/login", "POST", { email: identities.one.email, password: "password" }, null));
    assert.equal(login.session.access_token, "one");
    assert.equal(login.user.email_verified, true);
    assert.equal((await api("/api/auth/verify", "POST", { token_hash: "confirmation", type: "email" }, null)).status, 200);
    assert.equal((await api("/api/auth/verify", "POST", { token_hash: "partial-change", type: "email_change" }, null)).status, 202);
    assert.deepEqual(await json(await api("/api/auth/forgot-password", "POST", { email: "missing@example.test" }, null), 202), { ok: true });
    assert.equal((await api("/api/auth/resend-confirmation", "POST", { email: identities.one.email }, null)).status, 202);
    assert.equal((await api("/api/auth/password", "PATCH", { password: "another-long-password" })).status, 200);
    assert.equal((await api("/api/auth/email", "PATCH", { email: "new@example.test" })).status, 202);
    assert.equal((await api("/api/auth/refresh", "POST", { refresh_token: "refresh-one" }, null)).status, 200);
    assert.equal((await api("/api/auth/logout", "POST", {})).status, 200);
    assert.equal((await api("/settings")).status, 401);
    assert.equal((await api("/api/auth/refresh", "POST", { refresh_token: "refresh-one" }, null)).status, 401);
  }, { gateway });
  const passwordCall = calls.find(call => call.method === "PUT" && (call.body as { password?: string })?.password);
  assert.equal(passwordCall!.token, "one");
  assert.ok(calls.some(call => call.path.startsWith("signup?redirect_to=")));
});

test("email verification forwards normalized addresses and complete codes to the auth provider", async () => {
  const calls: Array<{ method: string; path: string; body?: object }> = [];
  const gateway: AuthGateway = { async request(method, path, body) {
    calls.push({ method, path, body });
    return tokenPayload;
  } };
  await withApi(async api => {
    for (const [token, type] of [["012345", "signup"], ["01234567", "recovery"], ["0123456789", "email"]]) {
      const result = await json(await api("/api/auth/verify", "POST", {
        email: "  " + identities.one.email.toUpperCase() + "  ", token, type,
      }, null));
      assert.equal(result.user.email_verified, true);
      assert.equal(result.user.id, identities.one.id);
      assert.deepEqual(calls.at(-1), {
        method: "POST", path: "verify", body: { email: identities.one.email, token, type },
      });
    }
  }, { gateway });
  assert.equal(calls.length, 3);
});

test("email verification rejects malformed codes, mixed link/code requests and unexpected fields before contacting the provider", async () => {
  let providerCalls = 0;
  const gateway: AuthGateway = { async request() { providerCalls++; return tokenPayload; } };
  await withApi(async api => {
    const input = { email: identities.one.email, token: "012345", type: "signup" };
    const invalid: object[] = [
      ...["", "12345", "12345678901", "12a456", "123 456", "123.45", " 012345"].map(token => ({ ...input, token })),
      { ...input, token: 123456 },
      { ...input, email: "invalid" },
      { ...input, type: "sms" },
      { ...input, token_hash: "confirmation" },
      { ...input, display_name: "Unexpected" },
      { email: input.email, token_hash: "confirmation", type: input.type },
      { token: input.token, type: input.type },
    ];
    for (const body of invalid) assert.equal((await api("/api/auth/verify", "POST", body, null)).status, 400);
  }, { gateway });
  assert.equal(providerCalls, 0);
});

test("invalid or expired verification codes and malformed provider responses never return a successful session", async () => {
  for (const status of [400, 429]) {
    const gateway: AuthGateway = { async request() { throw new HttpError(status, status === 400 ? "Verification code is invalid or expired." : "Too many verification attempts."); } };
    await withApi(async api => {
      const response = await api("/api/auth/verify", "POST", { email: identities.one.email, token: "012345", type: "recovery" }, null);
      const result = await json(response, status);
      assert.equal(result.session, undefined);
      assert.equal(result.user, undefined);
    }, { gateway });
  }
  await withApi(async api => {
    const response = await api("/api/auth/verify", "POST", { email: identities.one.email, token: "012345", type: "signup" }, null);
    const result = await json(response, 503);
    assert.equal(result.session, undefined);
  }, { gateway: { async request() { return {}; } } });
});

test("subscription CRUD scopes verified ownership and rejects unsafe amounts and default-resetting patches", async () => {
  await withApi(async api => {
    const bill = await createSubscription(api, { active: false, billing_cycle: "YEARLY" });
    const updated = (await json(await api("/subscriptions/" + bill.id, "PATCH", { name: "Renamed" }))).subscription;
    assert.equal(updated.active, false);
    assert.equal(updated.billing_cycle, "YEARLY");
    assert.equal(updated.is_business_expense, true);
    assert.equal((await api("/subscriptions/" + bill.id, "PATCH", { name: "Forbidden" }, "two")).status, 404);
    assert.equal((await api("/subscriptions/" + bill.id, "PATCH", { user_id: identities.two.id })).status, 400);
    assert.equal((await api("/subscriptions/" + bill.id, "PATCH", { expected_max_amount: 1 })).status, 400);
    assert.equal((await api("/subscriptions", "POST", { name: "Invalid", amount_minor: Number.MAX_SAFE_INTEGER + 1 })).status, 400);
    assert.equal((await json(await api("/subscriptions", "GET", undefined, "two"))).data.length, 0);
    const second = await createSubscription(api, {}, "two");
    assert.notEqual(second.id, bill.id);
    assert.equal((await json(await api("/subscriptions?business=true"))).data.length, 1);
    assert.equal((await api("/subscriptions?user_id=" + identities.two.id)).status, 400);
  });
});

test("pool invitations bind a verified email; contributions remain pending until an authenticated matching settlement", async () => {
  await withApi(async (api, url) => {
    const created = await createPool(api);
    const poolId = created.pool.id;
    assert.equal((await api("/pools/" + poolId, "GET", undefined, "two")).status, 404);
    assert.equal((await api("/pools/" + poolId, "PATCH", { balance_minor: 50 })).status, 400);
    const member = created.members.find((member: any) => member.invited_email === identities.two.email);
    const invitation = await json(await api("/pools/" + poolId + "/invites", "POST", { member_id: member.id }), 201);
    const stored = await pg.query<{ token_hash: string }>("select token_hash from public.pool_invites where id=$1", [invitation.invite.id]);
    assert.notEqual(stored.rows[0].token_hash, invitation.token);
    assert.equal(invitation.token.length, 43);
    assert.equal((await api("/invites/" + invitation.token, "GET", undefined, "agent")).status, 404);
    assert.equal((await api("/invites/" + invitation.token + "/accept", "POST", { email: identities.two.email }, "agent")).status, 400);
    const first = await json(await api("/invites/" + invitation.token + "/accept", "POST", {}, "two"));
    const retry = await json(await api("/invites/" + invitation.token + "/accept", "POST", {}, "two"));
    assert.equal(first.member.accepted_at, retry.member.accepted_at);
    assert.equal((await api("/pools/" + poolId, "PATCH", { fallback_enabled: false }, "two")).status, 404);
    const path = "/pools/" + poolId + "/contributions";
    assert.equal((await api(path, "POST", {}, "two")).status, 400);
    assert.equal((await api(path, "POST", { status: "SETTLED" }, "two", { "Idempotency-Key": "member-payment" })).status, 400);
    const pending = await json(await api(path, "POST", {}, "two", { "Idempotency-Key": "member-payment" }), 202);
    const replay = await json(await api(path, "POST", {}, "two", { "Idempotency-Key": "member-payment" }), 202);
    assert.equal(pending.contribution.id, replay.contribution.id);
    assert.equal(pending.contribution.status, "PENDING");
    const before = await json(await api("/pools/" + poolId));
    assert.equal(before.pool.balance_minor, 0);
    const payload = { provider_event_id: "settlement-1", contribution_id: pending.contribution.id, status: "SETTLED", amount_minor: 50, currency: "NGN" };
    const wrongBody = JSON.stringify({ ...payload, amount_minor: 49 });
    assert.equal((await fetch(url + "/api/webhooks/contributions", { method: "POST", headers: signedHeaders(wrongBody), body: wrongBody })).status, 400);
    const body = JSON.stringify(payload);
    const accepted = await fetch(url + "/api/webhooks/contributions", { method: "POST", headers: signedHeaders(body), body });
    assert.equal(accepted.status, 200);
    const duplicate = await fetch(url + "/api/webhooks/contributions", { method: "POST", headers: signedHeaders(body), body });
    assert.equal(duplicate.headers.get("x-idempotent-replay"), "true");
    const after = await json(await api("/pools/" + poolId));
    assert.equal(after.pool.balance_minor, 50);
    assert.equal(after.members.find((member: any) => member.user_id === identities.two.id).payment_status, "PAID");
    assert.equal((await api("/contributions/" + pending.contribution.id, "GET", undefined, "agent")).status, 404);
  });
});

test("transaction pages reach beyond 1,000 rows with stable timestamp ties; complete aggregates reconcile with exports", async () => {
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    select $1, 'bulk-' || n, 'Business expense',12345,'NGN','SETTLED',true,'2026-11-10T00:00:00Z',now() from generate_series(1,1205) n`, [identities.one.id]);
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    values ($1,'usd','USD expense',2000,'USD','SETTLED',true,'2026-11-10T00:00:00Z',now()),
      ($1,'declined','Declined',99,'NGN','DECLINED',true,'2026-11-10T00:00:00Z',null),
      ($1,'pending','Pending',99,'NGN','PENDING',true,'2026-11-10T00:00:00Z',null),
      ($1,'reversed','Reversed',99,'NGN','REVERSED',true,'2026-11-10T00:00:00Z',now()),
      ($1,'personal','Personal',99,'NGN','SETTLED',false,'2026-11-10T00:00:00Z',now()),
      ($1,'boundary','December boundary',99,'NGN','SETTLED',true,'2026-12-01T00:00:00Z',now()),
      ($2,'other-user','Other account',9999,'NGN','SETTLED',true,'2026-11-10T00:00:00Z',now())`, [identities.one.id, identities.two.id]);
  await withApi(async api => {
    let cursor: string | null = null; const seen: string[] = [];
    do {
      const result = await json(await api("/transactions?month=2026-11&business=true&limit=100" + (cursor ? "&cursor=" + cursor : "")));
      seen.push(...result.data.map((row: any) => row.id));
      cursor = result.next_cursor;
    } while (cursor);
    assert.equal(seen.length, 1209);
    assert.equal(new Set(seen).size, seen.length);
    const first = await json(await api("/transactions?month=2026-11&business=true&limit=10"));
    assert.equal((await api("/transactions?month=2026-10&business=true&cursor=" + first.next_cursor)).status, 400);
    assert.equal((await api("/transactions?month=2026-11&business=true&cursor=" + first.next_cursor, "GET", undefined, "two")).status, 400);
    const summary = await json(await api("/insights/summary?month=2026-11&business=true"));
    const ngn = summary.totals.find((total: any) => total.currency === "NGN");
    assert.equal(ngn.settled_count, 1205);
    assert.equal(ngn.settled_amount_minor, String(1205 * 12345));
    assert.equal(ngn.declined_count, 1); assert.equal(ngn.pending_count, 1); assert.equal(ngn.reversed_count, 1);
    const csv = await api("/export?month=2026-11&format=csv");
    assert.equal(csv.status, 200);
    const text = await csv.text();
    assert.equal(text.trimEnd().split("\r\n").length, 1207);
    assert.ok(!text.includes("Other account"));
    assert.ok(!text.includes("December boundary"));
    assert.ok(!text.includes("Personal"));
    const pdf = await api("/export?month=2026-11&format=pdf");
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.ok((await pdf.text()).startsWith("%PDF-1.4"));
    assert.equal((await api("/export?month=2026-13")).status, 400);
    assert.equal((await api("/export?month=2026-11&format=zip")).status, 400);
  });
});

test("transaction pagination preserves microsecond ordering and timestamp ties from PostgreSQL", async () => {
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,settled_at,created_at)
    select $1,'precise-' || n,'Precise timestamp',100,'NGN','SETTLED',true,now(),
      case when n = 1 then '2026-11-01T00:00:00.123457Z'::timestamptz
        when n = 5 then '2026-11-01T00:00:00.123455Z'::timestamptz
        else '2026-11-01T00:00:00.123456Z'::timestamptz end
    from generate_series(1,5) n`, [identities.one.id]);
  await withApi(async api => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const result = await json(await api("/transactions?month=2026-11&limit=1" + (cursor ? "&cursor=" + cursor : "")));
      seen.push(...result.data.map((row: any) => row.provider_transaction_id));
      cursor = result.next_cursor;
    } while (cursor);
    assert.equal(seen.length, 5);
    assert.equal(new Set(seen).size, 5);
    assert.equal(seen[0], "precise-1");
    assert.equal(seen[4], "precise-5");
  });
});

test("only owned settled transactions expose printable HTML/PDF receipts, including after reversal", async () => {
  await withApi(async (api, url) => {
    const payload = { provider_event_id: "pending-event", provider_transaction_id: "real-payment",
      user_id: identities.one.id, merchant_name: '<script>alert("x")</script> Ṣọpẹ', amount_minor: 2000,
      currency: "USD", status: "PENDING", is_business_expense: true, created_at: "2026-11-01T00:00:00Z" };
    async function webhook(value: object, headers?: Record<string, string>) {
      const body = JSON.stringify(value);
      return fetch(url + "/api/webhooks/settlements", { method: "POST", headers: headers ?? signedHeaders(body), body });
    }
    assert.equal((await webhook(payload, { ...signedHeaders(JSON.stringify(payload)), "x-retrest-signature": "0".repeat(64) })).status, 401);
    assert.equal((await webhook(payload, signedHeaders(JSON.stringify(payload), config.settlementWebhookSecret, String(Math.floor(Date.now() / 1000) - 600)))).status, 401);
    const pending = await json(await webhook(payload));
    const id = pending.transaction.id;
    assert.equal((await api("/receipts/" + id)).status, 404);
    await json(await webhook({ ...payload, provider_event_id: "settled-event", status: "SETTLED" }));
    assert.equal((await api("/receipts/" + id, "GET", undefined, "two")).status, 404);
    const html = await api("/receipts/" + id);
    assert.equal(html.headers.get("cache-control"), "no-store");
    assert.ok(html.headers.get("x-request-id"));
    const text = await html.text();
    assert.ok(text.includes("&lt;script&gt;"));
    assert.ok(!text.includes("<script>"));
    assert.ok(text.includes("Settled"));
    assert.equal((await api("/receipts/" + id + "?format=pdf")).headers.get("content-type"), "application/pdf");
    assert.equal((await api("/receipts/" + id + "?format=csv")).status, 400);
    const replay = await webhook({ ...payload, provider_event_id: "settled-event", status: "SETTLED" });
    assert.equal(replay.headers.get("x-idempotent-replay"), "true");
    assert.equal((await webhook({ ...payload, provider_event_id: "settled-event", status: "SETTLED", amount_minor: 2001 })).status, 400);
    await json(await webhook({ ...payload, provider_event_id: "reversal-event", status: "REVERSED" }));
    assert.equal((await api("/receipts/" + id)).status, 404);
    assert.equal((await api("/transactions/" + id, "GET", undefined, "two")).status, 404);
  });
});

test("settings persist between API restarts and device removal invalidates JWT and opaque trust", async () => {
  let device: any; let token: string;
  await withApi(async api => {
    const saved = await json(await api("/settings", "PATCH", {
      phone: "+2348012345678", theme: "light", time_zone: "Africa/Lagos", auto_fx_enabled: false, monthly_summary_email: true,
    }));
    assert.equal(saved.settings.theme, "light");
    assert.equal((await api("/settings", "PATCH", { user_id: identities.two.id, theme: "dark" })).status, 400);
    const created = await json(await api("/devices", "POST", { name: "Laptop" }), 201);
    device = created.device; token = created.trust_token;
    assert.equal((await api("/settings", "GET", undefined, "one", { "X-Retrest-Device-Token": token })).status, 200);
    assert.equal((await api("/settings", "GET", undefined, "two", { "X-Retrest-Device-Token": token })).status, 401);
  });
  await withApi(async api => {
    const settings = await json(await api("/settings"));
    assert.equal(settings.settings.theme, "light");
    assert.equal(settings.settings.phone, "+2348012345678");
    assert.equal((await api("/devices/" + device.id, "DELETE", undefined, "two")).status, 404);
    assert.equal((await api("/devices/" + device.id, "DELETE")).status, 200);
    assert.equal((await api("/settings")).status, 401);
    assert.equal((await api("/settings", "GET", undefined, "one", { "X-Retrest-Device-Token": token })).status, 401);
    assert.equal((await api("/settings", "GET", undefined, "oneNewSession")).status, 200);
    const devices = await json(await api("/devices", "GET", undefined, "oneNewSession"));
    assert.ok(devices.data[0].revoked_at);
    assert.ok(!("token_hash" in devices.data[0]));
  });
});

test("support conversations persist, enforce customer/staff roles and create durable read notifications", async () => {
  await withApi(async api => {
    const availability = await json(await api("/support/availability"));
    assert.equal(availability.transport, "database_inbox");
    const body = { subject: "Payment query", body: "Please explain my payment." };
    const first = await json(await api("/support/threads", "POST", body, "one", { "Idempotency-Key": "support-thread" }), 201);
    const retry = await json(await api("/support/threads", "POST", body, "one", { "Idempotency-Key": "support-thread" }), 201);
    assert.equal(first.thread.id, retry.thread.id);
    assert.equal(first.message.id, retry.message.id);
    assert.equal((await api("/support/threads", "POST", { ...body, body: "Different" }, "one", { "Idempotency-Key": "support-thread" })).status, 400);
    const path = "/support/threads/" + first.thread.id;
    assert.equal((await api(path, "GET", undefined, "two")).status, 404);
    assert.equal((await api(path + "/messages", "POST", { body: "Intrusion" }, "two", { "Idempotency-Key": "other-message" })).status, 404);
    assert.equal((await api("/support/inbox")).status, 403);
    assert.equal((await json(await api("/support/inbox", "GET", undefined, "agent"))).data.length, 1);
    assert.equal((await api(path + "/messages", "POST", { body: "Spoof", sender_role: "AGENT" }, "one", { "Idempotency-Key": "spoof-message" })).status, 400);
    const reply = await json(await api(path + "/messages", "POST", { body: "Here is the explanation." }, "agent", { "Idempotency-Key": "agent-message" }), 201);
    assert.equal(reply.message.sender_role, "AGENT");
    await json(await api(path + "/messages", "POST", { body: "Here is the explanation." }, "agent", { "Idempotency-Key": "agent-message" }), 201);
    const notifications = await json(await api("/notifications?unread=true"));
    assert.equal(notifications.unread_count, 1);
    assert.equal((await json(await api("/notifications/read", "PATCH", { ids: [notifications.data[0].id] }, "two"))).updated, 0);
    assert.equal((await json(await api("/notifications/read", "PATCH", { all: true }))).updated, 1);
    assert.equal((await json(await api("/notifications"))).unread_count, 0);
    assert.equal((await json(await api(path + "/messages"))).data.length, 2);
    await json(await api(path, "PATCH", { status: "CLOSED" }));
    assert.equal((await api(path + "/messages", "POST", { body: "New reply" }, "one", { "Idempotency-Key": "closed-thread" })).status, 409);
  });
  await withApi(async api => {
    assert.equal((await json(await api("/support/availability"))).accepting_messages, false);
    assert.equal((await api("/support/threads", "POST", { subject: "Unavailable", body: "Hello" }, "one", { "Idempotency-Key": "support-disabled" })).status, 503);
  }, { config: { supportEnabled: false } });
});

test("monthly summaries and email requests are owned, repeatable snapshots; delivery requires a verified provider event", async () => {
  await withApi(async (api, url) => {
    const first = await json(await api("/summaries", "POST", { month: "2026-11" }), 201);
    const retry = await json(await api("/summaries", "POST", { month: "2026-11" }), 201);
    assert.equal(first.summary.id, retry.summary.id);
    assert.equal((await api("/summaries/" + first.summary.id, "GET", undefined, "two")).status, 404);
    const path = "/summaries/" + first.summary.id + "/email";
    assert.equal((await api(path, "POST", { recipient: identities.two.email }, "one", { "Idempotency-Key": "summary-email" })).status, 400);
    const queued = await json(await api(path, "POST", {}, "one", { "Idempotency-Key": "summary-email" }), 202);
    const duplicate = await json(await api(path, "POST", {}, "one", { "Idempotency-Key": "summary-email" }), 202);
    assert.equal(queued.job.id, duplicate.job.id);
    assert.equal((await api("/email-jobs/" + queued.job.id, "GET", undefined, "two")).status, 404);
    const sent: string[] = [];
    const batch = await runEmailBatch(connections.admin, { async send(input) { sent.push(input.to); return "resend-message-id"; } });
    assert.equal(batch.accepted, 1);
    assert.deepEqual(sent, [identities.one.email]);
    assert.equal((await json(await api("/email-jobs/" + queued.job.id))).job.status, "ACCEPTED");
    const raw = JSON.stringify({ type: "email.delivered", data: { email_id: "resend-message-id" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(config.email!.webhookSecret!.replace("whsec_", ""), "base64");
    const signature = createHmac("sha256", key).update("delivery-event." + timestamp + "." + raw).digest("base64");
    const headers = { "Content-Type": "application/json", "svix-id": "delivery-event", "svix-timestamp": timestamp, "svix-signature": "v1," + signature };
    assert.equal((await fetch(url + "/api/webhooks/email", { method: "POST", headers: { ...headers, "svix-signature": "invalid" }, body: raw })).status, 401);
    assert.equal((await fetch(url + "/api/webhooks/email", { method: "POST", headers, body: raw })).status, 200);
    assert.equal((await fetch(url + "/api/webhooks/email", { method: "POST", headers, body: raw })).status, 200);
    assert.equal((await json(await api("/email-jobs/" + queued.job.id))).job.status, "DELIVERED");
  });
  await withApi(async api => {
    const summary = (await json(await api("/summaries", "POST", { month: "2026-11" }), 201)).summary;
    assert.equal((await api("/summaries/" + summary.id + "/email", "POST", {}, "one", { "Idempotency-Key": "disabled-email" })).status, 503);
  }, { config: { email: null } });
});

test("signed unsupported email events are acknowledged while delivery events require a message identity", async () => {
  await withApi(async (_api, url) => {
    const key = Buffer.from(config.email!.webhookSecret!.replace("whsec_", ""), "base64");
    async function send(payload: object, event: string) {
      const raw = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", key).update(event + "." + timestamp + "." + raw).digest("base64");
      return fetch(url + "/api/webhooks/email", { method: "POST", body: raw, headers: {
        "Content-Type": "application/json", "svix-id": event, "svix-timestamp": timestamp, "svix-signature": "v1," + signature,
      } });
    }
    for (const type of ["contact.created", "email.sent", "constructor"]) {
      assert.deepEqual(await json(await send({ type }, "ignored-" + type)), { ok: true, ignored: true });
    }
    assert.equal((await send({ type: "email.delivered", data: {} }, "missing-message")).status, 400);
    assert.equal((await pg.query<{ count: number }>("select count(*)::int as count from public.email_provider_events")).rows[0].count, 0);
  });
});

test("transient email failure retries safely and stops before the provider idempotency window expires", async () => {
  await withApi(async api => {
    const summary = (await json(await api("/summaries", "POST", { month: "2026-11" }), 201)).summary;
    const job = (await json(await api("/summaries/" + summary.id + "/email", "POST", {}, "one", { "Idempotency-Key": "retry-summary" }), 202)).job;
    await runEmailBatch(connections.admin, { async send() { throw new EmailProviderError("provider_unreachable", true); } });
    assert.equal((await json(await api("/email-jobs/" + job.id))).job.status, "QUEUED");
    await pg.query("update public.email_jobs set available_at=now(), first_attempt_at=now()-interval '24 hours' where id=$1", [job.id]);
    const result = await runEmailBatch(connections.admin, { async send() { assert.fail("expired uncertain delivery must not be resent"); } });
    assert.equal(result.claimed, 0);
    assert.equal((await json(await api("/email-jobs/" + job.id))).job.status, "FAILED");
  });
});

test("large PDF exports fail before sending headers and leave CSV available", async () => {
  await pg.query(`insert into public.transactions(user_id,provider_transaction_id,merchant_name,amount_minor,currency,status,is_business_expense,created_at,settled_at)
    select $1, 'pdf-' || n, 'Receipt',100,'NGN','SETTLED',true,'2026-11-01T00:00:00Z',now() from generate_series(1,5001) n`, [identities.one.id]);
  await withApi(async api => {
    const response = await api("/export?month=2026-11&format=pdf");
    assert.equal(response.status, 413);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.ok((await json(response, 413)).error.includes("CSV"));
  });
});
