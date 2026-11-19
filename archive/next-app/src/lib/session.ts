import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DEMO_USER_ID, demoEnabled } from "./db";

function secret() {
  const value = process.env.RETREST_SESSION_SECRET;
  if (!value && !demoEnabled()) throw new Error("RETREST_SESSION_SECRET must be configured");
  return value ?? "retrest-local-demo-session-only";
}
export function sessionToken() {
  return createHmac("sha256", secret()).update(DEMO_USER_ID).digest("hex");
}
export async function currentUser() {
  const token = (await cookies()).get("retrest_session")?.value;
  const expected = sessionToken();
  if (!token || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return null;
  return DEMO_USER_ID;
}
export function trustedMutation(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next's dev server may use 0.0.0.0 internally while the browser uses localhost.
  const hostOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  return request.headers.get("sec-fetch-site") !== "cross-site"
    && (!origin || origin === url.origin || origin === hostOrigin);
}
