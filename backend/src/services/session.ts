import { createHmac, timingSafeEqual } from "node:crypto";
import { DEMO_USER_ID } from "../constants.ts";

export const SESSION_COOKIE = "retrest_session";
export const SESSION_MAX_AGE_SECONDS = 86_400;

/** Signed demo session token. Only the demo identity can be issued in this build. */
export function sessionToken(secret: string, userId = DEMO_USER_ID) {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

/** Returns the user behind a session token, or null when it is missing or forged. */
export function verifySession(secret: string, token: string | undefined): string | null {
  const expected = sessionToken(secret);
  if (!token || token.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ? DEMO_USER_ID : null;
}
