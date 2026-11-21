import type { Dashboard, PoolMember } from "../../lib/types";
import { requestJson } from "../shared/api.ts";

// Exact POST /api/pools body and response from the selected demo handler.
export interface CreatePoolInput {
  subscription_id: string;
  name: string;
  members: Pick<PoolMember, "name" | "email" | "share_amount">[];
  fallback_enabled?: boolean;
}
export interface CreatePoolResult { state: Dashboard; invite_token: string }

export const loadPoolState = (signal?: AbortSignal) => requestJson<Dashboard>("/api/state", { signal });
export const createPool = (body: CreatePoolInput) => requestJson<CreatePoolResult>("/api/pools", { method: "POST", body });
export const setHostFallback = (id: string, fallback_enabled: boolean) => requestJson<Dashboard>(`/api/pools/${encodeURIComponent(id)}`, {
  method: "PATCH", body: { fallback_enabled },
});
export const simulateContribution = (id: string, member_id: string) => requestJson<Dashboard>(`/api/pools/${encodeURIComponent(id)}`, {
  method: "PATCH", body: { member_id },
});

// No allocation-edit endpoint is implemented. Do not issue a speculative PATCH.
export const poolCapabilities = { editAllocation: false, liveContributions: false } as const;
