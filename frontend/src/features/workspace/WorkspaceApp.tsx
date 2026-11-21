"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Currency, Dashboard, DemoResult, Subscription } from "@retrest/shared";
import { BottomNav, PageFooter, PageHeading, Sidebar, Topbar } from "@/components/layout";
import { ToastMessage } from "@/components/ui";
import { useClipboard } from "@/hooks/useClipboard";
import { useToast } from "@/hooks/useToast";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { usePreviewAccount } from "@/features/auth/preview-account";
import { InsightsView } from "@/features/insights/components/InsightsView";
import { PoolsView } from "@/features/pools/components/PoolsView";
import AccountSettings from "@/features/settings/components/AccountSettings";
import { setAutoFxPreference } from "@/features/settings/api";
import { setSubscriptionStatus } from "@/features/shield/api";
import { ShieldView } from "@/features/shield/components/ShieldView";
import { SupportChat } from "@/features/support/components/SupportChat";
import { TransactionsPage } from "@/features/transactions/components/TransactionsPage";
import { workspaceTotals } from "./selectors";
import type { WorkspaceDialog } from "./types";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import { WorkspaceProvider, useWorkspace, type WorkspaceContextValue } from "./WorkspaceContext";

/** The main content for one workspace section. */
function SectionContent({ section }: { section: WorkspaceSection }) {
  const { data, profile, busy, notify, mutate } = useWorkspace();
  switch (section) {
    case "shield":
      return <ShieldView />;
    case "pools":
      return <PoolsView />;
    case "insights":
      return <InsightsView />;
    case "transactions":
      return <TransactionsPage user={data.user} transactions={data.transactions} />;
    case "settings":
      return (
        <AccountSettings
          user={data.user}
          busy={busy}
          notify={notify}
          onAutoFx={() => mutate(() => setAutoFxPreference(!data.user.auto_fx_enabled), "Auto-conversion preference saved")}
        />
      );
    case "support":
      return <SupportChat name={profile.name} />;
  }
}

/** The signed-in workspace: shared state, layout shell, current section, and dialogs. */
export default function WorkspaceApp({ initial, section = "shield" }: { initial: Dashboard; section?: WorkspaceSection }) {
  const { toast, notify, dismiss } = useToast();
  const { copy, copied } = useClipboard(notify);
  const { data, setData, busy, isBusy, mutate, formError, setFormError } = useWorkspaceState(initial, notify);
  const account = usePreviewAccount();
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [dialog, setDialog] = useState<WorkspaceDialog | null>(null);
  const [demoResult, setDemoResult] = useState<Omit<DemoResult, "state"> | null>(null);

  const openDialog = useCallback(
    (next: WorkspaceDialog) => {
      setFormError("");
      setDialog(next);
    },
    [setFormError],
  );
  const closeDialog = useCallback(() => setDialog(null), []);

  // Changing section closes dialogs; `?simulator=1` deep-links straight into the simulator.
  useEffect(() => {
    setDialog(new URLSearchParams(window.location.search).get("simulator") === "1" ? { kind: "demo" } : null);
  }, [section]);

  const toggleSubscription = useCallback(
    async (subscription: Subscription) => {
      if (isBusy()) return;
      const status = subscription.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      const setStatus = (value: Subscription["status"]) =>
        setData((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((s) => (s.id === subscription.id ? { ...s, status: value } : s)),
        }));
      setStatus(status);
      const saved = await mutate(
        () => setSubscriptionStatus(subscription.id, status),
        status === "PAUSED"
          ? `${subscription.merchant_name} kill switch activated. Future charges are blocked.`
          : `${subscription.merchant_name} is active and protected.`,
      );
      if (!saved) setStatus(subscription.status);
    },
    [isBusy, mutate, setData],
  );

  const totals = useMemo(() => workspaceTotals(data, currency), [data, currency]);
  const profile = account?.profile ?? { name: data.user.name, email: data.user.email, phone: "" };

  const value: WorkspaceContextValue = {
    data,
    totals,
    currency,
    setCurrency,
    profile,
    account,
    busy,
    formError,
    mutate,
    notify,
    copy,
    copied,
    openDialog,
    closeDialog,
    toggleSubscription,
    demoResult,
    setDemoResult,
  };

  return (
    <WorkspaceProvider value={value}>
      <div className="app-shell">
        <Sidebar section={section} />
        <div className="workspace">
          <Topbar pageLabel={workspacePages[section].label} />
          <main className="main-content">
            <PageHeading section={section} />
            <SectionContent section={section} />
            <PageFooter />
          </main>
        </div>
        <BottomNav section={section} />
        {toast && <ToastMessage toast={toast} onDismiss={dismiss} />}
        <WorkspaceDialogs dialog={dialog} />
      </div>
    </WorkspaceProvider>
  );
}
