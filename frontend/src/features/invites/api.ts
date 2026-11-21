import { ApiError, requestJson } from "@/lib/api/client";

export interface DemoContributionResult { message: string }

/** Public invite contribution. The invite itself is loaded server-side (GET /api/invites/:token). */
export async function submitDemoContribution(token: string, email: string): Promise<DemoContributionResult> {
  const result = await requestJson<DemoContributionResult>(`/api/invites/${encodeURIComponent(token)}`, {
    method: "POST", body: { email: email.trim().toLowerCase() },
  });
  if (typeof result.message !== "string") throw new ApiError("The server did not confirm the contribution.");
  return result;
}

export function inviteReturnPath(token: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(token)) throw new ApiError("Invalid invitation link.");
  return `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
}
