import type { Dashboard } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

/** The full workspace snapshot (GET /api/state). Every screen renders from this. */
export const fetchWorkspace = (signal?: AbortSignal) => requestJson<Dashboard>("/api/state", { signal });
