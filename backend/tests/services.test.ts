import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readConfig } from "../src/config.ts";
import { HttpError } from "../src/lib/http.ts";
import { monthRange, parse, settingsPatch, subscriptionPatch, transactionQuery } from "../src/lib/feature-validation.ts";
import { page, pageScope, readCursor } from "../src/lib/pagination.ts";
import { verifyResendSignature, verifyTimestampedHmac } from "../src/lib/signatures.ts";
import { MemoryRateLimitStore } from "../src/middleware/rate-limit.ts";
import { createAuthGateway } from "../src/services/auth-gateway.ts";
import { businessExportCsv, makePdf, minorDecimal, receiptHtml } from "../src/services/documents.ts";
import { timeoutFetch } from "../src/lib/fetch.ts";
import { createResendProvider, EmailProviderError, runEmailBatch } from "../src/services/email.ts";
import type { Transaction } from "@retrest/shared";

test("month filters use UTC exclusive boundaries, including leap years", () => {
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01T00:00:00.000Z", to: "2024-03-01T00:00:00.000Z" });
  assert.deepEqual(monthRange("2026-12"), { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" });
  for (const input of [
    { month: "2026-13" }, { month: "2026-11", from: "2026-11-01T00:00:00Z" },
    { from: "2026-12-01T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    { limit: "101" }, { business: "yes" }, { user_id: "forged" },
  ]) assert.throws(() => parse(transactionQuery, input), HttpError);
  assert.equal(parse(transactionQuery, { business: "false" }).business, false);
});

test("partial subscription changes preserve omitted defaults; settings reject invalid zones and owner injection", () => {
  assert.deepEqual(parse(subscriptionPatch, { name: " New name " }), { name: "New name" });
  assert.throws(() => parse(subscriptionPatch, {}), HttpError);
  for (const input of [{ time_zone: "Moon/Somewhere" }, { phone: "08012345678" }, { user_id: "forged" }])
    assert.throws(() => parse(settingsPatch, input), HttpError);
  assert.equal(parse(settingsPatch, { time_zone: "Africa/Lagos", phone: "+2348012345678" }).phone, "+2348012345678");
});

test("keyset cursors preserve tie-breakers and reject malformed data and mismatched scopes", () => {
  const rows = ["c", "b", "a"].map(id => ({ id, created_at: "2026-11-01T00:00:00.000Z" }));
  const scope = pageScope("user-one", "transactions", { business: true });
  const result = page(rows, 2, scope);
  assert.deepEqual(result.data.map(row => row.id), ["c", "b"]);
  assert.deepEqual(readCursor(result.next_cursor!, scope), { id: "b", created_at: rows[0].created_at });
  const precise = rows.map(row => ({ ...row, created_at: "2026-11-01T00:00:00.123456+00:00" }));
  assert.equal(readCursor(page(precise, 1, scope).next_cursor!, scope)!.created_at, precise[0].created_at);
  assert.equal(page(rows.slice(0, 2), 2, scope).next_cursor, null);
  assert.throws(() => readCursor(result.next_cursor!, pageScope("user-two", "transactions", { business: true })), HttpError);
  assert.throws(() => readCursor(result.next_cursor!, pageScope("user-one", "transactions", { business: false })), HttpError);
  for (const cursor of ["bad!base64", Buffer.from('{"v":1}').toString("base64url")]) assert.throws(() => readCursor(cursor, scope), HttpError);
});

test("rate limiting bounds memory, keeps active limits and recovers after expiry", async () => {
  let now = 1000;
  const limits = new MemoryRateLimitStore(() => now, 2);
  assert.equal((await limits.consume("one", 2, 1000)).allowed, true);
  assert.equal((await limits.consume("one", 2, 1000)).allowed, true);
  assert.equal((await limits.consume("one", 2, 1000)).allowed, false);
  assert.equal((await limits.consume("two", 2, 1000)).allowed, true);
  assert.equal((await limits.consume("three", 2, 1000)).allowed, false);
  now = 2001;
  assert.equal((await limits.consume("three", 2, 1000)).allowed, true);
  assert.equal((await limits.consume("one", 2, 1000)).allowed, true);
});

test("webhook signatures cover raw UTF-8 bytes and enforce time windows and signature versions", () => {
  const now = Date.now(); const timestamp = String(Math.floor(now / 1000));
  const raw = Buffer.from('{"merchant":"Ṣọpẹ"}');
  const secret = "settlement-test-secret";
  const hex = createHmac("sha256", secret).update(timestamp + ".").update(raw).digest("hex");
  assert.equal(verifyTimestampedHmac(raw, timestamp, hex, secret, now), true);
  assert.equal(verifyTimestampedHmac(Buffer.from("{}"), timestamp, hex, secret, now), false);
  assert.equal(verifyTimestampedHmac(raw, timestamp, hex, secret, now + 301_000), false);
  const key = Buffer.from("resend-webhook-secret");
  const signature = createHmac("sha256", key).update("event." + timestamp + ".").update(raw).digest("base64");
  assert.equal(verifyResendSignature(raw, "event", timestamp, "v0,ignored v1," + signature, "whsec_" + key.toString("base64"), now), true);
  assert.equal(verifyResendSignature(raw, "different-event", timestamp, "v1," + signature, key.toString("base64"), now), false);
  assert.equal(verifyResendSignature(raw, "event", timestamp, "v2," + signature, key.toString("base64"), now), false);
});

test("exact decimal rendering and CSV/HTML escaping handle large amounts, formulas and markup", () => {
  assert.equal(minorDecimal("18014398509481982"), "180143985094819.82");
  assert.equal(minorDecimal(9007199254740991), "90071992547409.91");
  assert.equal(minorDecimal(-1), "-0.01");
  assert.throws(() => minorDecimal(Number.MAX_SAFE_INTEGER + 1));
  const row: Transaction = {
    id: "receipt", authorization_id: "event", user_id: "one", subscription_id: null, merchant_name: ' \t=SUM(1,2)<script>"',
    amount: 12345, currency: "NGN", status: "SETTLED", receipt_url: "/api/v1/receipts/receipt",
    decline_reason: null, fx_ngn_amount: 0, pool_amount: 0, created_at: "2026-11-01T00:00:00Z",
  };
  const csv = businessExportCsv([row]);
  assert.ok(csv.includes('"\' \t=SUM(1,2)<script>"""'));
  const html = receiptHtml(row, { demo: false });
  assert.ok(html.includes("&lt;script&gt;&quot;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Settled"));
  assert.ok(!html.includes("Demo transaction"));
  assert.ok(receiptHtml({ ...row, amount: 9007199254740991 }, { demo: false }).includes("90,071,992,547,409.91"));
});

test("long PDF text stays inside page margins without losing characters", () => {
  const source = "W".repeat(300);
  const pdf = makePdf([source]).toString();
  assert.ok(pdf.includes("/BaseFont /Courier"));
  const chunks = [...pdf.matchAll(/\((W+)\) Tj/g)].map(match => match[1]);
  assert.equal(chunks.join(""), source);
  // Standard Courier glyphs occupy 600/1000 em at 11pt; printable width is 499pt.
  assert.ok(chunks.every(chunk => chunk.length * 0.6 * 11 <= 499));
});

test("dependency fetch preserves caller cancellation and attaches a deadline", async () => {
  const source = new AbortController();
  let received: AbortSignal | null | undefined;
  const transport = timeoutFetch((async (_input, init) => { received = init?.signal; return Response.json({ ok: true }); }) as typeof fetch);
  await transport("https://example.test", { signal: source.signal });
  assert.ok(received);
  assert.equal(received!.aborted, false);
  source.abort();
  assert.equal(received!.aborted, true);
});

test("authentication adapter forwards private credentials only to the configured provider and sanitizes failures", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const gateway = createAuthGateway({ url: "https://example.supabase.co", anonKey: "private-anon-key" }, (async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({ ok: true });
  }) as typeof fetch);
  await gateway.request("PUT", "user", { email: "new@example.test" }, "private-access-token");
  assert.equal(requests[0].url, "https://example.supabase.co/auth/v1/user");
  assert.equal((requests[0].init!.headers as Record<string, string>).Authorization, "Bearer private-access-token");
  const unavailable = createAuthGateway({ url: "https://example.supabase.co", anonKey: "secret" }, (async () => { throw new Error("private internals"); }) as typeof fetch);
  await assert.rejects(unavailable.request("POST", "signup", {}), (error: unknown) => error instanceof HttpError && error.status === 503 && !error.message.includes("private"));
});

test("authentication failures explain password and recovery errors without exposing provider secrets", async context => {
  const logs: string[] = [];
  context.mock.method(console, "warn", (message: string) => { logs.push(message); });
  const cases = [
    ["same_password", 422, 400, /different from your current password/],
    ["weak_password", 422, 400, /security policy/],
    ["otp_expired", 403, 400, /invalid or expired/],
    ["flow_state_expired", 400, 400, /link has expired/],
    ["flow_state_not_found", 400, 400, /already been used/],
    ["bad_code_verifier", 400, 400, /browser where you requested/],
    ["reauthentication_needed", 400, 401, /fresh password recovery/],
    ["reauthentication_not_valid", 400, 401, /recovery verification is invalid/],
    ["session_not_found", 403, 401, /session has ended/],
    ["session_expired", 403, 401, /session has expired/],
    ["private_unknown_error", 400, 400, /Authentication request rejected/],
  ] as const;
  for (const [code, providerStatus, status, expected] of cases) {
    for (const payload of [
      { code, message: "private provider internals and password" },
      { code: providerStatus, error_code: code, msg: "private provider internals and password" },
    ]) {
      const gateway = createAuthGateway({ url: "https://example.supabase.co", anonKey: "private-anon-key" },
        async () => Response.json(payload, { status: providerStatus }));
      await assert.rejects(gateway.request("PUT", "user", { password: "private-password" }, "private-access-token"),
        (error: unknown) => error instanceof HttpError && error.status === status && expected.test(error.message)
          && !error.message.includes("private"));
    }
  }
  assert.equal(logs.length, cases.length * 2);
  assert.ok(logs.every(log => !log.includes("private")));
  assert.equal(JSON.parse(logs.at(-1)!).code, "unknown");
  const malformed = createAuthGateway({ url: "https://example.supabase.co", anonKey: "private-key" },
    async () => new Response("private malformed provider response", { status: 403 }));
  await assert.rejects(malformed.request("POST", "verify", {}),
    (error: unknown) => error instanceof HttpError && error.status === 401 && !error.message.includes("private"));
});

test("Resend retries use the same idempotency key and classify permanent provider rejection", async () => {
  const keys: string[] = [];
  const provider = createResendProvider({ provider: "resend", apiKey: "private-api-key", from: "receipts@example.test" }, (async (_url, init) => {
    keys.push((init!.headers as Record<string, string>)["Idempotency-Key"]);
    return Response.json({ id: "provider-message" });
  }) as typeof fetch);
  const input = { id: "job-id", to: "one@example.test", subject: "Summary", html: "<p>Summary</p>" };
  assert.equal(await provider.send(input), "provider-message");
  assert.equal(await provider.send(input), "provider-message");
  assert.deepEqual(keys, ["retrest-email-job-id", "retrest-email-job-id"]);
  const rejected = createResendProvider({ provider: "resend", apiKey: "key", from: "sender@example.test" }, (async () => new Response(null, { status: 422 })) as typeof fetch);
  await assert.rejects(rejected.send(input), (error: unknown) => error instanceof EmailProviderError && !error.retryable);
});

test("email worker marks corrupt payloads permanently failed without sending them", async () => {
  const calls: Array<{ name: string; input?: any }> = [];
  const admin = { async rpc(name: string, input?: any) {
    calls.push({ name, input });
    return { data: name === "claim_email_jobs" ? [{ id: "11111111-1111-4111-8111-111111111111", claim_token: "22222222-2222-4222-8222-222222222222", payload: null }] : true, error: null };
  } } as unknown as SupabaseClient;
  const outcome = await runEmailBatch(admin, { async send() { assert.fail("corrupt job must not be sent"); } });
  assert.equal(outcome.accepted, 0);
  assert.equal(calls[1].input.p_error_code, "invalid_job_payload");
  assert.equal(calls[1].input.p_retryable, false);
});

test("production defaults disable the demo and reject weak hosted secrets and invalid proxy/origin configuration", () => {
  const supabase = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "test-key" };
  assert.equal(readConfig({ NODE_ENV: "production", ...supabase }).demoEnabled, false);
  assert.throws(() => readConfig({ NODE_ENV: "production", RETREST_DEMO_ENABLED: "true", RETREST_SESSION_SECRET: "short" }));
  assert.throws(() => readConfig({ CORS_ORIGINS: "https://example.com/path" }));
  assert.throws(() => readConfig({ TRUST_PROXY: "true" }));
  assert.throws(() => readConfig({ RETREST_DEMO_ENABLED: "sometimes" }));
  assert.equal(readConfig({ TRUST_PROXY: "false" }).trustProxy, false);
});
