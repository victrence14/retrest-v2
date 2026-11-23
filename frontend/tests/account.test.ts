import { test } from "node:test";
import assert from "node:assert/strict";
import { accountPage, accountQuery, accountReceipt, exactAccountMoney } from "@/features/account/api";
import { beginAccountOperation, finishAccountOperation, readAccountOperation } from "@/features/account/operations";
import { cleanCallbackUrl, readAuthCallback } from "@/features/auth/api";
import { ApiError, ensureSession, requestJson } from "@/lib/api/client";
import { safeDestination } from "@/lib/navigation";

test("auth callbacks support confirmation, recovery fragments and PKCE and remove callback secrets", () => {
  const confirmation = new URL("https://app.test/login?token_hash=opaque&type=signup&next=%2Fpools");
  assert.deepEqual(readAuthCallback(confirmation), { action: "verify", body: { token_hash: "opaque", type: "signup" }, recovery: false });
  assert.equal(cleanCallbackUrl(confirmation), "/login?next=%2Fpools");
  const recovery = new URL("https://app.test/reset-password#access_token=access&refresh_token=refresh&expires_in=1200&type=recovery");
  assert.deepEqual(readAuthCallback(recovery), { action: "session", body: { access_token: "access", refresh_token: "refresh", expires_in: 1200 }, recovery: true });
  assert.equal(cleanCallbackUrl(recovery), "/reset-password");
  const exchange = new URL("https://app.test/reset-password?code=auth-code");
  assert.throws(() => readAuthCallback(exchange), /browser where you started/);
  assert.equal(readAuthCallback(exchange, "a".repeat(43))?.action, "exchange");
  assert.throws(() => readAuthCallback(new URL("https://app.test/login#error_description=expired")), /expired/);
  assert.throws(() => readAuthCallback(new URL("https://app.test/login#access_token=incomplete")), /incomplete/);
  assert.throws(() => readAuthCallback(new URL("https://app.test/login?token_hash=x&type=unsupported")), /Unsupported/);
  assert.equal(readAuthCallback(new URL("https://app.test/login")), null);
  assert.equal(safeDestination("https://evil.test"), "/shield");
  assert.equal(safeDestination("//evil.test"), "/shield");
  assert.equal(safeDestination("/invite/" + "a".repeat(43)), "/invite/" + "a".repeat(43));
});

test("pending operation keys survive retries/reloads, are scoped to account and payload, and store no message text", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  try {
    const first = await beginAccountOperation("one", "support-new", { subject: "Payment", body: "Private message" });
    assert.equal((await beginAccountOperation("one", "support-new", { subject: "Payment", body: "Private message" })).key, first.key);
    assert.equal(readAccountOperation("one", "support-new")?.key, first.key);
    assert.doesNotMatch([...storage.values()].join(""), /Private message|Payment/);
    assert.notEqual((await beginAccountOperation("two", "support-new", { subject: "Payment", body: "Private message" })).key, first.key);
    const changed = await beginAccountOperation("one", "support-new", { subject: "Payment", body: "Updated message" });
    assert.notEqual(changed.key, first.key);
    finishAccountOperation("one", "support-new", first.key);
    assert.equal(readAccountOperation("one", "support-new")?.key, changed.key);
    finishAccountOperation("one", "support-new", changed.key);
    assert.equal(readAccountOperation("one", "support-new"), null);
    assert.notEqual((await beginAccountOperation("one", "support-new", { subject: "Payment", body: "Updated message" })).key, changed.key);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("account aggregates format exact amounts above the JavaScript integer limit without currency mixing", () => {
  assert.equal(exactAccountMoney("9007199254740993", "NGN"), "₦90,071,992,547,409.93");
  assert.equal(exactAccountMoney("29", "USD"), "$0.29");
  assert.throws(() => exactAccountMoney("1.01", "NGN"), /invalid amount/);
  assert.throws(() => exactAccountMoney("-1", "NGN"), /invalid amount/);
  assert.equal(accountQuery("transactions", { business: false, month: "2026-11", cursor: "opaque+cursor", empty: "", missing: undefined }), "/api/v1/transactions?business=false&month=2026-11&cursor=opaque%2Bcursor");
});

test("account files and collections enforce the account contract; API errors retain request IDs and retry delays", async () => {
  const original = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (url, init) => {
    paths.push(String(url));
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    return new Response("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } });
  };
  try {
    for (const status of ["PENDING", "DECLINED", "REVERSED"] as const) assert.throws(() => accountReceipt({ id: "owned", status }), /settled payments/);
    await accountReceipt({ id: "owned", status: "SETTLED" });
    assert.deepEqual(paths, ["/api/v1/receipts/owned?format=pdf"]);
    globalThis.fetch = async () => Response.json({ data: [] });
    await assert.rejects(accountPage("subscriptions"), /invalid collection/);
    globalThis.fetch = async () => Response.json({ error: "Please wait" }, { status: 429, headers: { "X-Request-ID": "support-123", "Retry-After": "8" } });
    await assert.rejects(requestJson("/api/v1/support/threads"), (error: unknown) => error instanceof ApiError && error.status === 429 && error.requestId === "support-123" && error.retryAfter === 8);
  } finally { globalThis.fetch = original; }
});

test("demo-session failures do not poison subsequent retries", async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return attempts === 1 ? Response.json({ error: "Unavailable" }, { status: 503 }) : Response.json({ ok: true }); };
  try { await assert.rejects(ensureSession(), /Unavailable/); await ensureSession(); await ensureSession(); assert.equal(attempts, 2); }
  finally { globalThis.fetch = original; }
});
