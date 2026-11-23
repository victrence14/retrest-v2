import express, { Router } from "express";
import { z } from "zod";
import type { Config } from "../config.ts";
import type { SupabaseClients } from "../lib/supabase.ts";
import type { AuthGateway } from "../services/auth-gateway.ts";
import { authContext, requireAuth } from "../middleware/supabase-auth.ts";
import { requireVerifiedAccount } from "../middleware/account-auth.ts";
import { rateLimit, type RateLimitStore } from "../middleware/rate-limit.ts";
import { databaseResult } from "../lib/database-result.ts";
import { parse } from "../lib/feature-validation.ts";
import { HttpError, sendError } from "../lib/http.ts";

const email = z.string().trim().pipe(z.email().max(254)).transform(value => value.toLowerCase());
const password = z.string().min(12).max(128);
const tokenResponse = z.object({
  access_token: z.string().min(1), refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(), expires_at: z.number().int().optional(),
  token_type: z.string(), user: z.object({
    id: z.uuid(), email: z.email().optional(), email_confirmed_at: z.string().nullish(),
  }),
});
function sessionResponse(value: unknown) {
  const result = tokenResponse.safeParse(value);
  if (!result.success) throw new HttpError(503, "Invalid authentication provider response.");
  const { user, ...session } = result.data;
  return { session, user: { id: user.id, email: user.email, email_verified: !!user.email_confirmed_at } };
}

export function authenticationRoutes(config: Config, clients: SupabaseClients | null, gateway: AuthGateway | null,
  limits: RateLimitStore) {
  const router = Router();
  router.use(rateLimit(limits, "auth", 30, 10 * 60_000), express.json({ limit: "16kb" }));
  if (!gateway || !clients) {
    router.use((_request, response) => sendError(response, 503, "Supabase authentication is not configured."));
    return router;
  }
  const redirect = () => `?redirect_to=${encodeURIComponent(config.authRedirectUrl ?? "http://localhost:3000/login")}`;
  router.post("/signup", async (request, response) => {
    const input = parse(z.object({ email, password, display_name: z.string().trim().min(1).max(80) }).strict(), request.body);
    await gateway.request("POST", `signup${redirect()}`, { email: input.email, password: input.password, data: { display_name: input.display_name } });
    response.status(202).json({ confirmation_required: true });
  });
  router.post("/login", async (request, response) => {
    const input = parse(z.object({ email, password: z.string().min(1).max(128) }).strict(), request.body);
    try { response.json(sessionResponse(await gateway.request("POST", "token?grant_type=password", input))); }
    catch (error) {
      if (error instanceof HttpError && error.status === 400) throw new HttpError(401, "Email or password is incorrect.");
      throw error;
    }
  });
  router.post("/refresh", async (request, response) => {
    const input = parse(z.object({ refresh_token: z.string().min(1).max(4096) }).strict(), request.body);
    let session;
    try { session = sessionResponse(await gateway.request("POST", "token?grant_type=refresh_token", input)); }
    catch (error) {
      if (error instanceof HttpError && error.status === 400) throw new HttpError(401, "Refresh token is invalid or expired.");
      throw error;
    }
    // A refreshed JWT retains the same session_id; server revocation still wins.
    const db = clients.forUser(session.session.access_token);
    if (!databaseResult<boolean>(await db.rpc("is_account_session_active")))
      throw new HttpError(401, "This session has been revoked. Log in again.");
    response.json(session);
  });
  router.post("/verify", async (request, response) => {
    const type = z.enum(["email", "signup", "recovery", "email_change"]);
    const input = parse(z.union([
      z.object({ token_hash: z.string().min(1).max(512), type }).strict(),
      z.object({ email, token: z.string().regex(/^[0-9]{6,10}$/), type }).strict(),
    ]), request.body);
    const verified = await gateway.request("POST", "verify", input);
    if (input.type === "email_change" && !verified.access_token)
      return response.status(202).json({ confirmation_required: true });
    response.json(sessionResponse(verified));
  });
  router.post("/resend-confirmation", async (request, response) => {
    const input = parse(z.object({ email }).strict(), request.body);
    try {
      await gateway.request("POST", "resend", { type: "signup", email: input.email, email_redirect_to: config.authRedirectUrl });
    } catch (error) { if (!(error instanceof HttpError) || error.status >= 429) throw error; }
    response.status(202).json({ ok: true });
  });
  router.post("/exchange", async (request, response) => {
    const input = parse(z.object({
      auth_code: z.string().min(1).max(512), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    }).strict(), request.body);
    response.json(sessionResponse(await gateway.request("POST", "token?grant_type=pkce", input)));
  });
  router.post("/forgot-password", async (request, response) => {
    const input = parse(z.object({ email }).strict(), request.body);
    try {
      await gateway.request("POST", `recover?redirect_to=${encodeURIComponent(config.authRecoveryRedirectUrl ?? "http://localhost:3000/reset-password")}`, input);
    } catch (error) { if (!(error instanceof HttpError) || error.status >= 429) throw error; }
    response.status(202).json({ ok: true });
  });
  router.post("/logout", requireAuth(clients), async (request, response) => {
    parse(z.object({}).strict(), request.body ?? {});
    const { db, token } = authContext(response);
    databaseResult(await db.rpc("revoke_current_session"));
    await gateway.request("POST", "logout?scope=local", {}, token);
    response.json({ ok: true });
  });
  router.patch("/password", requireAuth(clients), requireVerifiedAccount, async (request, response) => {
    const input = parse(z.object({ password }).strict(), request.body);
    await gateway.request("PUT", "user", input, authContext(response).token);
    response.json({ ok: true });
  });
  router.patch("/email", requireAuth(clients), requireVerifiedAccount, async (request, response) => {
    const input = parse(z.object({ email }).strict(), request.body);
    await gateway.request("PUT", `user${redirect()}`, input, authContext(response).token);
    response.status(202).json({ confirmation_required: true });
  });
  return router;
}
