// Test-only entry point: real API/RLS, disposable SQLite/PostgreSQL, stubbed Auth transport.
import { createApp } from "../src/app.ts";
import { HttpError } from "../src/lib/http.ts";
import type { AuthGateway } from "../src/services/auth-gateway.ts";
import { createTestPostgres } from "../tests/helpers/postgres.ts";
import { identities, postgresClients, resetFeatureFixtures, type IdentityName } from "../tests/helpers/supabase.ts";

const controlSecret = process.env.RETREST_TEST_CONTROL_SECRET;
const origin = process.env.RETREST_TEST_FRONTEND_ORIGIN;
const port = Number(process.env.RETREST_TEST_BACKEND_PORT);
if (!controlSecret || controlSecret.length < 32 || !origin || !port) throw new Error("Use npm run test:ui to start this disposable fixture.");
const pg = await createTestPostgres();
const connections = postgresClients(pg);
const passwords = new Map<string, string>();
const refreshTokens = new Map<string, IdentityName>();
let refreshCount = 0;
async function reset() {
  await resetFeatureFixtures(pg);
  passwords.clear(); refreshTokens.clear(); refreshCount = 0;
  for (const name of ["one", "two"] as const) passwords.set(identities[name].email, "LongEnoughPassword!");
}
await reset();
function session(name: IdentityName, refreshed = false) {
  const account = identities[name];
  const refresh = `${refreshed ? "rotated" : "refresh"}-${name}`;
  refreshTokens.set(refresh, name);
  return { access_token: name, refresh_token: refresh, expires_in: 3600, token_type: "bearer",
    user: { id: account.id, email: account.email, email_confirmed_at: "2026-01-01T00:00:00Z" } };
}
const gateway: AuthGateway = { async request(_method, path, payload, token) {
  const body = payload as Record<string, string> | undefined;
  if (path.startsWith("signup")) {
    if (body?.email !== identities.one.email) throw new HttpError(400, "Use the disposable test identity.");
    passwords.set(body.email, body.password);
    await pg.query("update auth.users set email_confirmed_at=null where id=$1", [identities.one.id]);
    return {};
  }
  if (path.includes("grant_type=password")) {
    const name = body?.email === identities.one.email ? "one" : body?.email === identities.two.email ? "two" : null;
    if (!name || passwords.get(body!.email) !== body!.password) throw new HttpError(400, "Invalid credentials.");
    const result = await pg.query<{ email_confirmed_at: string | null }>("select email_confirmed_at from auth.users where id=$1", [identities[name].id]);
    if (!result.rows[0].email_confirmed_at) throw new HttpError(400, "Email has not been confirmed.");
    return session(name);
  }
  if (path.includes("grant_type=refresh_token")) {
    const name = refreshTokens.get(body?.refresh_token ?? "");
    if (!name) throw new HttpError(400, "Invalid refresh token.");
    refreshCount++;
    return session(name, true);
  }
  if (path === "verify") {
    if (body?.token !== "12345678" && body?.token_hash !== "confirm-one") throw new HttpError(400, "Verification code is invalid or expired.");
    await pg.query("update auth.users set email_confirmed_at=now() where id=$1", [identities.one.id]);
    return session(body?.type === "recovery" ? "oneNewSession" : "one");
  }
  if (path.startsWith("user") && token) {
    if (body?.password) passwords.set(identities[token as IdentityName].email, body.password);
    return {};
  }
  if (path.startsWith("recover") || path === "resend" || path.startsWith("logout")) return {};
  throw new HttpError(400, "Unsupported disposable auth request.");
} };
const app = createApp({
  nodeEnv: "test", port, databasePath: ":memory:", demoEnabled: true,
  sessionSecret: "retrest-disposable-browser-session-secret", webhookSecret: "retrest-disposable-browser-card-secret",
  corsOrigins: [origin], authRedirectUrl: origin + "/login", authRecoveryRedirectUrl: origin + "/reset-password",
  supabase: { url: "https://fixture.example.test", anonKey: "fixture-only" },
}, { supabase: connections.clients, admin: connections.admin, authGateway: gateway });
// These controls exist only in this script and are never registered in the production server.
const server = app.listen(port, "127.0.0.1");
const controls = server.listeners("request").slice();
server.removeAllListeners("request");
server.on("request", async (request, response) => {
  if (request.url?.startsWith("/_test/")) {
    if (request.headers["x-retrest-test-secret"] !== controlSecret) { response.writeHead(403).end(); return; }
    try {
      if (request.url === "/_test/reset" && request.method === "POST") await reset();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ refreshCount }));
    } catch { response.writeHead(500).end(); }
    return;
  }
  for (const listener of controls) listener.call(server, request, response);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  server.close(() => { app.locals.close(); void pg.close().then(() => process.exit()); });
  server.closeIdleConnections();
});
console.log("Disposable browser API ready.");
