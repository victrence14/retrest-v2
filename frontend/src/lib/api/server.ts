import { cookies } from "next/headers";
import type { Dashboard, InviteSummary } from "@retrest/shared";

/** Where the Express backend listens. Server-only; the browser always uses same-origin /api. */
export const BACKEND_URL = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

/** Server Component fetch to the backend, forwarding the visitor's cookies. Null on 401/404. */
async function backendJson<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Backend request ${path} failed with ${response.status}.`);
  return (await response.json()) as T;
}

/** The workspace for the first render: the session's account, or the public demo. */
export const getInitialDashboard = () => backendJson<Dashboard>("/api/bootstrap");

export const getInvite = (token: string) => backendJson<InviteSummary>(`/api/invites/${encodeURIComponent(token)}`);
