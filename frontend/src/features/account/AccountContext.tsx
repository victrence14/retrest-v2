"use client";

import { createContext, useContext } from "react";
import type { AccountUser, ProfileRecord, SettingsRecord } from "@retrest/shared";

export interface AccountContextValue {
  user: AccountUser;
  profile: ProfileRecord;
  setProfile: (profile: ProfileRecord) => void;
  settings: SettingsRecord;
  setSettings: (settings: SettingsRecord) => void;
  busy: boolean;
  onError: (error: unknown) => void;
  notify: (text: string, error?: boolean) => void;
  run: <T>(action: () => Promise<T>, message?: string) => Promise<T | null>;
}
export const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("An account screen requires AccountContext.");
  return value;
}
