import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { authContext } from "./supabase-auth.ts";
import { databaseResult } from "../lib/database-result.ts";
import { sendError } from "../lib/http.ts";

/** Runs after requireAuth. Both JWT revocation and device trust are server-backed. */
export const requireVerifiedAccount: RequestHandler = async (request, response, next) => {
  const { user, db } = authContext(response);
  if (!user.email_confirmed_at) return sendError(response, 403, "Confirm your email before using account features.");
  const active = databaseResult<boolean>(await db.rpc("is_account_session_active"));
  if (!active) return sendError(response, 401, "This session has been revoked. Log in again.");
  const token = request.get("x-retrest-device-token");
  if (token !== undefined) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return sendError(response, 401, "Device trust is invalid or expired.");
    const result = await db.rpc("verify_device", { p_token_hash: createHash("sha256").update(token).digest("hex") });
    if (result.error?.code === "P0002") return sendError(response, 401, "Device trust is invalid or expired.");
    databaseResult(result);
  }
  next();
};
