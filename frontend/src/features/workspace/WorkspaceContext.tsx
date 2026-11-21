"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Currency, Dashboard, DemoResult, Subscription } from "@retrest/shared";
import type { PreviewAccount } from "@/features/auth/preview-account";
import type { WorkspaceTotals } from "./selectors";
import type { Profile, WorkspaceDialog } from "./types";

type Mutate = <T extends Dashboard | { state: Dashboard }>(request: () => Promise<T>, message?: string) => Promise<T | null>;

export interface WorkspaceContextValue {
  data: Dashboard;
  totals: WorkspaceTotals;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  profile: Profile;
  account: PreviewAccount | null;
  busy: boolean;
  formError: string;
  mutate: Mutate;
  notify: (text: string, error?: boolean) => void;
  copy: (text: string) => Promise<void>;
  copied: boolean;
  openDialog: (dialog: WorkspaceDialog) => void;
  closeDialog: () => void;
  /** Optimistically flips a merchant's kill switch, reverting if the server rejects it. */
  toggleSubscription: (subscription: Subscription) => Promise<void>;
  /** The last simulator result, kept while the drawer is closed and reopened. */
  demoResult: Omit<DemoResult, "state"> | null;
  setDemoResult: (result: Omit<DemoResult, "state"> | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  return value;
}
