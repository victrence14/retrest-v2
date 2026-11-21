import type { Dashboard } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

export const setAutoFxPreference = (auto_fx_enabled: boolean) =>
  requestJson<Dashboard>("/api/settings", { method: "PATCH", body: { auto_fx_enabled } });
