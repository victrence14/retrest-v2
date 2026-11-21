"use client";

import { DialogFrame } from "@/components/ui";
import { SimulatorDialog } from "@/features/demo/components/SimulatorDialog";
import { HelpDialog } from "@/features/help/components/HelpDialog";
import { SpendSummary } from "@/features/insights/components/SpendSummary";
import { NotificationsDialog } from "@/features/notifications/components/NotificationsDialog";
import { CreatePoolDialog } from "@/features/pools/components/CreatePoolDialog";
import { AddSubscriptionDialog } from "@/features/shield/components/AddSubscriptionDialog";
import { FundWalletDialog } from "@/features/shield/components/FundWalletDialog";
import { MerchantDialog } from "@/features/shield/components/MerchantDialog";
import { SupportChat } from "@/features/support/components/SupportChat";
import type { WorkspaceDialog } from "./types";
import { useWorkspace } from "./WorkspaceContext";

const DRAWERS: Partial<Record<WorkspaceDialog["kind"], { className: string; label: string }>> = {
  demo: { className: "demo-drawer", label: "Live charge simulator" },
  chat: { className: "support-drawer", label: "Chat with us" },
  summary: { className: "summary-drawer", label: "Monthly spend summary" },
};

function DialogContent({ dialog }: { dialog: WorkspaceDialog }) {
  const { data, profile, notify } = useWorkspace();
  switch (dialog.kind) {
    case "demo":
      return <SimulatorDialog />;
    case "chat":
      return <SupportChat name={profile.name} />;
    case "summary":
      return <SpendSummary data={data} email={profile.email} notify={notify} />;
    case "fund":
      return <FundWalletDialog />;
    case "add":
      return <AddSubscriptionDialog />;
    case "create-pool":
      return <CreatePoolDialog subscriptionId={dialog.subscriptionId} />;
    case "notifications":
      return <NotificationsDialog />;
    case "help":
      return <HelpDialog />;
    case "merchant":
      return <MerchantDialog merchant={dialog.subscription} />;
  }
}

/** Renders the open workspace dialog, if any, inside the shared accessible frame. */
export function WorkspaceDialogs({ dialog }: { dialog: WorkspaceDialog | null }) {
  const { busy, closeDialog } = useWorkspace();
  if (!dialog) return null;
  const drawer = DRAWERS[dialog.kind];
  const label = dialog.kind === "merchant" ? `${dialog.subscription.merchant_name} settings` : (drawer?.label ?? "RETREST controls");
  return (
    // Keyed by dialog so focus management restarts whenever the dialog changes.
    <DialogFrame
      key={dialog.kind === "merchant" ? `merchant-${dialog.subscription.id}` : dialog.kind}
      label={label}
      drawer={!!drawer}
      className={drawer?.className}
      busy={busy}
      onClose={closeDialog}
    >
      <DialogContent dialog={dialog} />
    </DialogFrame>
  );
}
