"use client";

import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, MessageCircle, Play } from "lucide-react";
import { Avatar, Brand } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export function Topbar({ pageLabel }: { pageLabel: string }) {
  const { currency, setCurrency, openDialog, totals, profile, account, notify } = useWorkspace();
  return (
    <header className="topbar">
      <Link href="/" className="header-brand" aria-label="RETREST home">
        <Brand compact />
        <b>RETREST</b>
      </Link>
      <div className="breadcrumb">
        Workspace <ChevronRight size={13} />
        <span>{pageLabel}</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <span className="live-chip">
          <span className="status-dot" />
          System operational
        </span>
        <button
          className="currency-control"
          onClick={() => {
            const next = currency === "NGN" ? "USD" : "NGN";
            setCurrency(next);
            notify(`Display currency switched to ${next}.`);
          }}
          aria-label="Switch display currency"
        >
          <span className={"flag " + (currency === "USD" ? "us" : "")} />
          {currency}
          <ChevronDown size={13} />
        </button>
        <button className="button simulator-trigger" aria-label="Demo Simulator" onClick={() => openDialog({ kind: "demo" })}>
          <Play size={13} fill="currentColor" />
          <span>Demo Simulator</span>
        </button>
        <button className="header-chat icon-button" aria-label="Chat with us" onClick={() => openDialog({ kind: "chat" })}>
          <MessageCircle size={18} />
          <span>Chat with us</span>
        </button>
        <button className="icon-button notification-button" aria-label="Notifications" onClick={() => openDialog({ kind: "notifications" })}>
          <Bell size={19} />
          {totals.unread.length > 0 && <i />}
        </button>
        <Link
          href={account ? "/settings?demo=1" : "/login?next=%2Fshield"}
          className="topbar-profile"
          aria-label={account ? "Account settings" : "Log in"}
        >
          <Avatar name={profile.name} small />
        </Link>
      </div>
    </header>
  );
}
