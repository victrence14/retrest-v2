import { test } from "node:test";
import assert from "node:assert/strict";
import { accountCookieNames, proxyAccount, proxyAuth, type AccountProxyConfig } from "@/lib/api/account-proxy";

const origin = "https://app.example.test";
let instance = 0;
const config = (secureCookies = true): AccountProxyConfig => ({ backendUrl: `https://api-${++instance}.example.test`, appOrigin: origin, secureCookies });
const session = { access_token: "verified.access.token", refresh_token: "rotated-refresh", expires_in: 3600 };
const user = { id: "11111111-1111-4111-8111-111111111111", email: "one@example.test", email_verified: true };
const sessionResponse = () => Response.json({ session, user }, { headers: { "X-Request-ID": "request-123" } });
function request(path: string, init: RequestInit = {}) {
  const headers = new Headers({ Origin: origin, "Content-Type": "application/json", ...Object.fromEntries(new Headers(init.headers)) });
  return new Request(origin + path, { ...init, headers });
}
const cookieHeader = (values: { access?: string; refresh?: string; device?: string }, secure = true) => {
  const names = accountCookieNames(secure);
  return Object.entries(values).map(([key, value]) => `${names[key as keyof typeof names]}=${value}`).join("; ");
};
const cookies = (response: Response) => response.headers.getSetCookie();

test("login exposes only identity and stores host-scoped HttpOnly tokens", async () => {
  const options = config();
  let upstream: RequestInit | undefined;
  const response = await proxyAuth(request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "long-password" }), headers: { Authorization: "Bearer browser-spoof" } }), "login", options,
    async (url, init) => { assert.equal(String(url), options.backendUrl + "/api/auth/login"); upstream = init; return sessionResponse(); });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user });
  assert.equal(new Headers(upstream?.headers).get("Authorization"), null);
  assert.equal(response.headers.get("X-Request-ID"), "request-123");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(cookies(response).length, 3);
  for (const cookie of cookies(response)) {
    assert.match(cookie, /^__Host-retrest_account_/);
    assert.match(cookie, /Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
    assert.doesNotMatch(cookie, /Domain=/);
  }
  assert.ok(cookies(response).some(value => value.includes("device=;") && value.includes("Max-Age=0")));
});

test("signup and partial email confirmation retain their 202 contract without issuing sessions", async () => {
  for (const action of ["signup", "verify"]) {
    const response = await proxyAuth(request(`/api/auth/${action}`, { method: "POST", body: "{}" }), action, config(),
      async () => Response.json({ confirmation_required: true }, { status: 202 }));
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { confirmation_required: true });
    assert.deepEqual(cookies(response), []);
  }
});

test("an invalid provider session fails without leaking tokens or setting cookies", async () => {
  for (const invalid of [null, { ...session, expires_in: -1 }, { ...session, access_token: "unsafe;token" }, { ...session, refresh_token: "" }]) {
    const response = await proxyAuth(request("/api/auth/login", { method: "POST", body: "{}" }), "login", config(),
      async () => Response.json({ session: invalid, user }));
    assert.equal(response.status, 503);
    assert.deepEqual(cookies(response), []);
    assert.doesNotMatch(await response.text(), /verified\.access|rotated-refresh/);
  }
});

test("fragment callbacks verify the account before storing tokens and clear old device trust", async () => {
  const options = config();
  let authorization: string | null = null;
  const response = await proxyAuth(request("/api/auth/session", { method: "POST", body: JSON.stringify(session), headers: { Cookie: cookieHeader({ device: "x".repeat(43) }) } }), "session", options,
    async (url, init) => {
      assert.equal(String(url), options.backendUrl + "/api/v1/me");
      assert.equal(init?.method, "GET");
      authorization = new Headers(init?.headers).get("Authorization");
      assert.equal(new Headers(init?.headers).get("X-Retrest-Device-Token"), null);
      return Response.json({ user });
    });
  assert.equal(authorization, `Bearer ${session.access_token}`);
  assert.deepEqual(await response.json(), { user });
  assert.ok(cookies(response).some(value => value.startsWith("__Host-retrest_account_device=;") && value.includes("Max-Age=0")));
  for (const [status, payload] of [[401, { error: "Invalid identity" }], [200, { user: { ...user, email_verified: false } }]] as const) {
    const rejected = await proxyAuth(request("/api/auth/session", { method: "POST", body: JSON.stringify(session) }), "session", config(), async () => Response.json(payload, { status }));
    assert.equal(rejected.status, status === 401 ? 401 : 403);
    assert.deepEqual(cookies(rejected), []);
  }
});

test("same-origin writes reject missing/cross-site origins and forwarded-host spoofing", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return Response.json({ ok: true }); };
  const rejectedHeaders: Record<string, string>[] = [{ Origin: "https://evil.example" }, { Origin: "" }, { Origin: origin, "Sec-Fetch-Site": "cross-site" }, { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" }];
  for (const headers of rejectedHeaders) {
    const incoming = request("/api/v1/profile", { method: "PATCH", body: "{}", headers });
    assert.equal((await proxyAccount(incoming, ["profile"], config(), transport)).status, 403);
    assert.equal((await proxyAuth(request("/api/auth/logout", { method: "POST", headers }), "logout", config(), transport)).status, 403);
  }
  assert.equal(calls, 0);
});

test("direct same-origin writes use the browser Host instead of Next's binding address", async () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "192.168.1.20:3000"]) {
    const options = { ...config(false), appOrigin: undefined };
    const headers = { Host: host, Origin: `http://${host}`, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };
    const auth = await proxyAuth(new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers, body: "{}",
    }), "login", options, async () => sessionResponse());
    assert.equal(auth.status, 200, host);
    assert.deepEqual(await auth.json(), { user });
    const account = await proxyAccount(new Request("http://0.0.0.0:3000/api/v1/profile", {
      method: "PATCH", body: "{}", headers: { ...headers, Cookie: cookieHeader({ access: "valid" }, false) },
    }), ["profile"], options, async () => Response.json({ profile: { display_name: "One" } }));
    assert.equal(account.status, 200, host);
  }
});

test("unconfigured origins still reject missing origins, host/protocol mismatches and forwarded-host spoofing", async () => {
  const options = { ...config(false), appOrigin: undefined };
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return sessionResponse(); };
  for (const origin of ["", "null", "https://evil.example", "http://0.0.0.0:3000", "https://localhost:3000", "http://localhost:3001"]) {
    const incoming = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers: { Host: "localhost:3000", Origin: origin, "X-Forwarded-Host": "evil.example" },
    });
    assert.equal((await proxyAuth(incoming, "login", options, transport)).status, 403);
  }
  // A configured public origin stays authoritative even when Host matches a different Origin.
  const local = new Request("http://0.0.0.0:3000/api/auth/login", {
    method: "POST", headers: { Host: "localhost:3000", Origin: "http://localhost:3000" },
  });
  assert.equal((await proxyAuth(local, "login", config(), transport)).status, 403);
  assert.equal(calls, 0);
});

test("account requests forward server cookies, filters and retry keys while ignoring browser bearer tokens", async () => {
  const options = config(false);
  const incoming = request("/api/v1/pools/pool-id/contributions?limit=50", { method: "POST", headers: {
    Cookie: cookieHeader({ access: "cookie-access", device: "d".repeat(43) }, false), Authorization: "Bearer browser-spoof", "Idempotency-Key": "retry-operation-key",
  } });
  const response = await proxyAccount(incoming, ["pools", "pool-id", "contributions"], options, async (url, init) => {
    assert.equal(String(url), options.backendUrl + "/api/v1/pools/pool-id/contributions?limit=50");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer cookie-access");
    assert.equal(headers.get("X-Retrest-Device-Token"), "d".repeat(43));
    assert.equal(headers.get("Idempotency-Key"), "retry-operation-key");
    assert.equal(headers.get("Cookie"), null);
    return Response.json({ contribution: { status: "PENDING" } }, { status: 202 });
  });
  assert.equal(response.status, 202);
});

test("missing access cookies refresh once and rotate cookies without returning session JSON", async () => {
  const options = config();
  const calls: string[] = [];
  const response = await proxyAccount(request("/api/v1/me", { headers: { Cookie: cookieHeader({ refresh: "old-refresh" }) } }), ["me"], options, async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth/refresh")) { assert.deepEqual(JSON.parse(String(init?.body)), { refresh_token: "old-refresh" }); return sessionResponse(); }
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${session.access_token}`);
    return Response.json({ user });
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(await response.json(), { user });
  assert.equal(cookies(response).length, 2);
});

test("parallel expired reads share refresh; aborting the first reader does not abort the refresh", async () => {
  const options = config();
  let refreshCount = 0;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const controller = new AbortController();
  const transport: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshCount++; began(); await ready;
      assert.equal(init?.signal?.aborted, false);
      return sessionResponse();
    }
    init?.signal?.throwIfAborted();
    return Response.json({ user });
  };
  const headers = { Cookie: cookieHeader({ refresh: "shared-refresh" }) };
  const first = proxyAccount(request("/api/v1/me", { headers, signal: controller.signal }), ["me"], options, transport);
  await started;
  const second = proxyAccount(request("/api/v1/profile", { headers }), ["profile"], options, transport);
  const third = proxyAccount(request("/api/v1/settings", { headers }), ["settings"], options, transport);
  controller.abort(); release();
  const responses = await Promise.all([first, second, third]);
  assert.equal(responses[1].status, 200);
  assert.equal(responses[2].status, 200);
  assert.equal(refreshCount, 1);
  for (const response of responses.slice(1)) assert.equal(cookies(response).length, 2);
});

test("a guarded 401 retries at most once; service failures do not repeat mutations", async () => {
  for (const initialStatus of [401, 503]) {
    const options = config();
    let writes = 0, refreshCount = 0;
    const response = await proxyAccount(request("/api/v1/profile", { method: "PATCH", body: '{"display_name":"One"}', headers: { Cookie: cookieHeader({ access: "expired", refresh: "retry-refresh" }) } }), ["profile"], options,
      async url => {
        if (String(url).endsWith("/auth/refresh")) { refreshCount++; return sessionResponse(); }
        writes++; return Response.json({ error: "Unavailable or revoked" }, { status: initialStatus });
      });
    assert.equal(response.status, initialStatus);
    assert.equal(writes, initialStatus === 401 ? 2 : 1);
    assert.equal(refreshCount, initialStatus === 401 ? 1 : 0);
    if (initialStatus === 401) for (const cookie of cookies(response).slice(-3)) assert.match(cookie, /Max-Age=0/);
    else assert.equal(cookies(response).length, 0);
  }
});

test("revoked refreshes clear all session cookies; temporary refresh failures retain them", async () => {
  for (const status of [401, 503]) {
    const response = await proxyAccount(request("/api/v1/me", { headers: { Cookie: cookieHeader({ refresh: "revoked-refresh" }) } }), ["me"], config(),
      async () => Response.json({ error: "Refresh rejected" }, { status }));
    assert.equal(response.status, status);
    assert.equal(cookies(response).length, status === 401 ? 3 : 0);
    if (status === 401) assert.ok(cookies(response).every(cookie => cookie.includes("Max-Age=0")));
  }
});

test("logout clears browser credentials even when the account service is unreachable", async () => {
  const response = await proxyAuth(request("/api/auth/logout", { method: "POST", headers: { Cookie: cookieHeader({ access: "signed-in" }) } }), "logout", config(), async () => { throw new Error("offline"); });
  assert.equal(response.status, 503);
  assert.equal(cookies(response).length, 3);
  assert.ok(cookies(response).every(cookie => cookie.includes("Max-Age=0")));
});

test("device registration strips the trust token and stores it in an HttpOnly cookie", async () => {
  const device = { id: "device", name: "Recognised browser" };
  const response = await proxyAccount(request("/api/v1/devices", { method: "POST", body: '{"name":"Recognised browser"}', headers: { Cookie: cookieHeader({ access: "valid" }) } }), ["devices"], config(),
    async () => Response.json({ device, trust_token: "t".repeat(43) }, { status: 201 }));
  assert.deepEqual(await response.json(), { device });
  assert.equal(cookies(response).length, 1);
  assert.match(cookies(response)[0], /account_device=t+; Path=\/; HttpOnly; SameSite=Lax/);
});

test("authenticated documents stream their bytes and preserve MIME, filename and request metadata", async () => {
  const response = await proxyAccount(request("/api/v1/receipts/owned?format=pdf", { headers: { Cookie: cookieHeader({ access: "valid" }), Accept: "application/pdf" } }), ["receipts", "owned"], config(), async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("Accept"), "application/pdf");
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("%PDF-1.4\n")); controller.enqueue(new TextEncoder().encode("owned receipt")); controller.close(); } }), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="owned.pdf"', "X-Request-ID": "receipt-request", "Set-Cookie": "upstream-secret=hidden",
    } });
  });
  assert.equal(await response.text(), "%PDF-1.4\nowned receipt");
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="owned.pdf"');
  assert.equal(response.headers.get("X-Request-ID"), "receipt-request");
  assert.deepEqual(cookies(response), []);
});

test("malformed/oversized inputs and invalid destinations fail before calling the backend", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return Response.json({ ok: true }); };
  for (const [body, status] of [["{", 400], ["[]", 400], ["null", 400], [JSON.stringify({ name: "x".repeat(33 * 1024) }), 413]] as const) {
    assert.equal((await proxyAccount(request("/api/v1/profile", { method: "PATCH", body }), ["profile"], config(), transport)).status, status);
  }
  for (const parts of [[], [".."], ["profile/../me"], ["https:"], ["%2Fme"]]) {
    assert.equal((await proxyAccount(request("/api/v1/profile"), parts, config(), transport)).status, 400);
  }
  assert.equal((await proxyAuth(request("/api/auth/signup", { method: "POST", body: JSON.stringify({ name: "x".repeat(17 * 1024) }) }), "signup", config(), transport)).status, 413);
  assert.equal((await proxyAuth(request("/api/auth/session", { method: "POST", body: "{}" }), "session", config(), transport)).status, 400);
  assert.equal((await proxyAuth(request("/api/auth/unknown", { method: "POST" }), "unknown", config(), transport)).status, 404);
  assert.equal((await proxyAuth(request("/api/auth/login"), "login", config(), transport)).status, 405);
  assert.equal(calls, 0);
});

test("rate-limit responses preserve the retry delay and request ID", async () => {
  const response = await proxyAccount(request("/api/v1/me", { headers: { Cookie: cookieHeader({ access: "valid" }) } }), ["me"], config(),
    async () => Response.json({ error: "Try again later" }, { status: 429, headers: { "Retry-After": "12", "X-Request-ID": "limited-request" } }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "12");
  assert.equal(response.headers.get("X-Request-ID"), "limited-request");
});
