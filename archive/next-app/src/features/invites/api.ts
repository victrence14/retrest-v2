import { FeatureApiError, requestJson } from "../shared/api.ts";

export interface DemoContributionResult { message: string }

/** There is no GET invite API. Lookup is the existing server-rendered invite route. */
export async function submitDemoContribution(token: string, email: string): Promise<DemoContributionResult> {
  const result = await requestJson<DemoContributionResult>(`/api/invites/${encodeURIComponent(token)}`, {
    method: "POST", body: { email: email.trim().toLowerCase() },
  });
  if (typeof result.message !== "string") throw new FeatureApiError("The server did not confirm the contribution.");
  return result;
}

export function inviteReturnPath(token: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(token)) throw new FeatureApiError("Invalid invitation link.");
  return `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
}

// Verified identity, expiration/revocation, and live settlement are not in the demo schema.
export const inviteCapabilities = { verifiedAcceptance: false, liveSettlement: false } as const;
