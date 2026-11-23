import { createHash } from "node:crypto";

/** This module is used only by Node Route Handlers, never by client components. */
export interface AccountProxyConfig {
  backendUrl: string;
  appOrigin?: string;
  secureCookies: boolean;
}
interface Session { access_token: string; refresh_token: string; expires_in: number }
type Transport = typeof fetch;
const refreshes = new Map<string, { until: number; result: Promise<Response> }>();
const tokenPattern = /^[A-Za-z0-9._~-]{1,3500}$/;

export function accountCookieNames(secure = process.env.NODE_ENV === "production") {
  const prefix = secure ? "__Host-" : "";
  return { access: `${prefix}retrest_account_access`, refresh: `${prefix}retrest_account_refresh`, device: `${prefix}retrest_account_device` };
}
export function accountProxyConfig(): AccountProxyConfig {
  return { backendUrl: (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
    appOrigin: process.env.APP_ORIGIN?.trim() || undefined, secureCookies: process.env.NODE_ENV === "production" };
}
function readCookie(request: Request, name: string) {
  const entry = request.headers.get("cookie")?.split(";").find(item => item.trim().startsWith(`${name}=`));
  if (!entry) return undefined;
  try { const value = decodeURIComponent(entry.trim().slice(name.length + 1)); return tokenPattern.test(value) ? value : undefined; }
  catch { return undefined; }
}
function cookie(response: Response, name: string, value: string, maxAge: number, secure: boolean) {
  response.headers.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}
function clearSession(response: Response, config: AccountProxyConfig) {
  for (const name of Object.values(accountCookieNames(config.secureCookies))) cookie(response, name, "", 0, config.secureCookies);
  return response;
}
function storeSession(response: Response, session: Session, config: AccountProxyConfig) {
  const names = accountCookieNames(config.secureCookies);
  cookie(response, names.access, session.access_token, session.expires_in, config.secureCookies);
  cookie(response, names.refresh, session.refresh_token, 30 * 86_400, config.secureCookies);
  return response;
}
function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
function trustedWrite(request: Request, config: AccountProxyConfig) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const url = new URL(request.url);
  // Next constructs request.url from its bind address (e.g. 0.0.0.0), which can
  // differ from the host visited by the browser. Ignore forwarded host headers;
  // TLS-terminating deployments must configure their exact public APP_ORIGIN.
  const origin = config.appOrigin ?? `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  return request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function sessionFrom(value: unknown): Session | null {
  if (!object(value) || !object(value.session)) return null;
  const session = value.session;
  if (typeof session.access_token !== "string" || !tokenPattern.test(session.access_token)
    || typeof session.refresh_token !== "string" || !tokenPattern.test(session.refresh_token)
    || typeof session.expires_in !== "number" || !Number.isInteger(session.expires_in)
    || session.expires_in < 1 || session.expires_in > 86_400) return null;
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in };
}
async function bodyText(request: Request, limit: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new RangeError("Payload too large."); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}
function forwarded(response: Response) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["Content-Type", "Content-Disposition", "X-Request-ID", "Retry-After", "X-Idempotent-Replay"])
    if (response.headers.has(name)) headers.set(name, response.headers.get(name)!);
  return new Response(response.body, { status: response.status, headers });
}
async function send(request: Request, path: string, config: AccountProxyConfig, transport: Transport,
  body?: string, token?: string, device?: string, method = request.method) {
  const headers = new Headers({ Accept: request.headers.get("accept") ?? "application/json" });
  if (body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (device) headers.set("X-Retrest-Device-Token", device);
  const key = request.headers.get("idempotency-key");
  if (key) headers.set("Idempotency-Key", key);
  return transport(`${config.backendUrl}${path}`, { method, headers, cache: "no-store", redirect: "error",
    ...(body ? { body } : {}), signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]) });
}
async function refresh(request: Request, token: string, config: AccountProxyConfig, transport: Transport) {
  const key = createHash("sha256").update(`${config.backendUrl}:${token}`).digest("hex");
  const now = Date.now();
  for (const [name, entry] of refreshes) if (entry.until <= now) refreshes.delete(name);
  let entry = refreshes.get(key);
  if (!entry) {
    // Coalesce simultaneous resource reads without retaining credentials as map keys.
    if (refreshes.size >= 256) refreshes.delete(refreshes.keys().next().value!);
    // The refresh is shared: aborting one caller must not cancel other resource reads.
    const refreshRequest = new Request(request.url, { headers: { Accept: "application/json" } });
    entry = { until: now + 5000, result: send(refreshRequest, "/api/auth/refresh", config, transport,
      JSON.stringify({ refresh_token: token }), undefined, undefined, "POST") };
    refreshes.set(key, entry);
    entry.result.catch(() => refreshes.delete(key));
  }
  return (await entry.result).clone();
}
async function authenticated(request: Request, path: string, body: string, config: AccountProxyConfig, transport: Transport) {
  const names = accountCookieNames(config.secureCookies);
  let access = readCookie(request, names.access);
  const refreshToken = readCookie(request, names.refresh);
  const device = readCookie(request, names.device);
  let session: Session | null = null;
  const renew = async (): Promise<Response | null> => {
    if (!refreshToken) return clearSession(problem(401, "Please log in to continue."), config);
    const response = await refresh(request, refreshToken, config, transport);
    if (!response.ok) return response.status === 401 ? clearSession(forwarded(response), config) : forwarded(response);
    session = sessionFrom(await response.json());
    if (!session) return problem(503, "The sign-in service returned an invalid response.");
    access = session.access_token;
    return null;
  };
  if (!access) { const error = await renew(); if (error) return error; }
  let upstream = await send(request, path, config, transport, body, access, device);
  if (upstream.status === 401 && !session && refreshToken) {
    await upstream.body?.cancel();
    const error = await renew();
    if (error) return error;
    // A 401 is produced by the backend auth guard before the operation is performed.
    upstream = await send(request, path, config, transport, body, access, device);
  }
  let response: Response;
  if (upstream.ok && request.method === "POST" && path === "/api/v1/devices") {
    const value: unknown = await upstream.json();
    if (!object(value) || typeof value.trust_token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.trust_token))
      return problem(503, "The device service returned an invalid response.");
    const { trust_token, ...publicValue } = value;
    response = Response.json(publicValue, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    if (upstream.headers.has("X-Request-ID")) response.headers.set("X-Request-ID", upstream.headers.get("X-Request-ID")!);
    cookie(response, names.device, trust_token, 30 * 86_400, config.secureCookies);
  } else response = forwarded(upstream);
  if (session) storeSession(response, session, config);
  if (upstream.status === 401) clearSession(response, config);
  return response;
}

export async function proxyAccount(request: Request, segments: string[], config = accountProxyConfig(), transport: Transport = fetch) {
  if (!segments.length || segments.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return problem(400, "Invalid account destination.");
  if (!trustedWrite(request, config)) return problem(403, "This request must come from the application.");
  try {
    const body = await bodyText(request, 32 * 1024);
    if (body && request.headers.get("content-type")?.split(";")[0] !== "application/json") return problem(400, "Send a JSON request.");
    if (body) { try { if (!object(JSON.parse(body))) return problem(400, "Send a JSON object."); } catch { return problem(400, "Invalid JSON request."); } }
    return await authenticated(request, `/api/v1/${segments.join("/")}${new URL(request.url).search}`, body, config, transport);
  } catch (error) {
    return problem(error instanceof RangeError ? 413 : 503, error instanceof RangeError ? "Payload too large." : "The account service is temporarily unavailable.");
  }
}

export async function proxyAuth(request: Request, action: string, config = accountProxyConfig(), transport: Transport = fetch) {
  const methods: Record<string, string> = { signup: "POST", login: "POST", verify: "POST", exchange: "POST",
    "resend-confirmation": "POST", "forgot-password": "POST", refresh: "POST", session: "POST", logout: "POST", password: "PATCH", email: "PATCH" };
  if (!Object.hasOwn(methods, action)) return problem(404, "Authentication route not found.");
  if (request.method !== methods[action]) return problem(405, "Method not allowed.");
  if (!trustedWrite(request, config)) return problem(403, "This request must come from the application.");
  try {
    const body = await bodyText(request, 16 * 1024);
    if (body && request.headers.get("content-type")?.split(";")[0] !== "application/json") return problem(400, "Send a JSON request.");
    if (body) { try { if (!object(JSON.parse(body))) return problem(400, "Send a JSON object."); } catch { return problem(400, "Invalid JSON request."); } }
    if (["password", "email", "logout"].includes(action)) {
      const response = await authenticated(request, `/api/auth/${action}`, body, config, transport);
      return action === "logout" ? clearSession(response, config) : response;
    }
    let upstream: Response;
    if (action === "session") {
      // Supabase's default email redirect can return tokens in the URL fragment.
      let value: unknown;
      try { value = JSON.parse(body); } catch { return problem(400, "Invalid sign-in callback."); }
      const session = sessionFrom({ session: value });
      if (!session) return problem(400, "Invalid sign-in callback.");
      upstream = await send(request, "/api/v1/me", config, transport, undefined, session.access_token, undefined, "GET");
      if (!upstream.ok) return forwarded(upstream);
      const identity: unknown = await upstream.json();
      if (!object(identity) || !object(identity.user) || identity.user.email_verified !== true) return problem(403, "Confirm your email before signing in.");
      const response = storeSession(Response.json(identity, { headers: { "Cache-Control": "no-store" } }), session, config);
      cookie(response, accountCookieNames(config.secureCookies).device, "", 0, config.secureCookies);
      return response;
    }
    if (action === "refresh") {
      const token = readCookie(request, accountCookieNames(config.secureCookies).refresh);
      if (!token) return clearSession(problem(401, "Please log in again."), config);
      upstream = await refresh(request, token, config, transport);
    } else upstream = await send(request, `/api/auth/${action}`, config, transport, body);
    if (!upstream.ok) return action === "refresh" && upstream.status === 401 ? clearSession(forwarded(upstream), config) : forwarded(upstream);
    const value: unknown = await upstream.json();
    const session = sessionFrom(value);
    if (["login", "refresh", "exchange"].includes(action) || (object(value) && "session" in value)) {
      if (!session || !object(value)) return problem(503, "The sign-in service returned an invalid response.");
      const response = Response.json({ user: value.user }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
      if (upstream.headers.has("X-Request-ID")) response.headers.set("X-Request-ID", upstream.headers.get("X-Request-ID")!);
      storeSession(response, session, config);
      if (action !== "refresh") cookie(response, accountCookieNames(config.secureCookies).device, "", 0, config.secureCookies);
      return response;
    }
    return Response.json(value, { status: upstream.status, headers: { "Cache-Control": "no-store", ...(upstream.headers.has("X-Request-ID") ? { "X-Request-ID": upstream.headers.get("X-Request-ID")! } : {}) } });
  } catch (error) {
    const response = problem(error instanceof RangeError ? 413 : 503, error instanceof RangeError ? "Payload too large." : "The sign-in service is temporarily unavailable.");
    return action === "logout" ? clearSession(response, config) : response;
  }
}
