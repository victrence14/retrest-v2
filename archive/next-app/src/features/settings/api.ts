import type { Dashboard } from "../../lib/types";
import { requestJson } from "../shared/api.ts";

export const loadSettingsState = (signal?: AbortSignal) => requestJson<Dashboard>("/api/state", { signal });
export const setAutoFxPreference = (auto_fx_enabled: boolean) => requestJson<Dashboard>("/api/settings", {
  method: "PATCH", body: { auto_fx_enabled },
});

// Phone/preferences, confirmed email changes and devices have no selected-app contracts.
export const settingsCapabilities = { autoFx: true, phone: false, emailConfirmation: false, serverDevices: false } as const;
