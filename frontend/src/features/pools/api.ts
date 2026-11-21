import type { CreatePoolInput, CreatePoolResult, Dashboard } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

const poolPath = (id: string) => `/api/pools/${encodeURIComponent(id)}`;

export const createPool = (body: CreatePoolInput) =>
  requestJson<CreatePoolResult>("/api/pools", { method: "POST", body });

export const setHostFallback = (id: string, fallback_enabled: boolean) =>
  requestJson<Dashboard>(poolPath(id), { method: "PATCH", body: { fallback_enabled } });

/** Demo mode: records one member's share as paid (the host's own share debits their wallet). */
export const simulateContribution = (id: string, member_id: string) =>
  requestJson<Dashboard>(poolPath(id), { method: "PATCH", body: { member_id } });
