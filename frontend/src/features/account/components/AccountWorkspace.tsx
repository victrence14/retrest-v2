"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import type { AccountUser, ProfileRecord, SettingsRecord } from "@retrest/shared";
import { Avatar, Brand } from "@/components/ui";
import { PageFooter } from "@/components/layout/PageFooter";
import { PRIMARY_NAV, UTILITY_NAV } from "@/components/layout/navigation";
import { useToast } from "@/hooks/useToast";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useTheme } from "@/features/theme/ThemeProvider";
import type { ResolvedTheme } from "@/features/theme/theme";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { ApiError, errorMessage, isAbort } from "@/lib/api/client";
import { logout } from "@/features/auth/api";
import { getAccountProfile, getAccountSettings, getAccountUser, readAccountNotifications, updateAccountSettings } from "../api";
import { AccountContext } from "../AccountContext";
import { AccountSubscriptions } from "./AccountSubscriptions";
import { AccountPools } from "./AccountPools";
import { AccountTransactions } from "./AccountTransactions";
import { AccountInsights } from "./AccountInsights";
import { AccountSettings } from "./AccountSettings";
import { AccountSupport } from "./AccountSupport";
import { AccountNotifications } from "./AccountNotifications";
import "../styles.css";

const descriptions: Record<WorkspaceSection, string> = {
  shield: "Manage your subscriptions, merchant limits and billing dates.",
  pools: "Share a subscription with verified members and track contributions.",
  transactions: "Your complete payment history, confirmed receipts and decision reasons.",
  insights: "Complete monthly totals and business receipt exports, in each currency.",
  settings: "Your saved details, preferences and trusted devices.",
  support: "Send a message and follow replies in your support inbox.",
};

export default function AccountWorkspace({ section }: { section: WorkspaceSection }) {
  const router = useRouter();
  const { notify } = useToast();
  const { adoptAccountPreference } = useTheme();
  const [identity, setIdentity] = useState<{ user: AccountUser; profile: ProfileRecord; settings: SettingsRecord } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [notifications, setNotifications] = useState(false);
  const [unread, setUnread] = useState(0);
  const onError = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      notify("Your session has expired. Log in again.", true);
      router.replace(`/login?next=${encodeURIComponent(workspacePages[section].href)}`); router.refresh();
    } else if (!isAbort(failure)) notify(errorMessage(failure), true);
  }, [router, section, notify]);
  const refreshUnread = useCallback(async () => {
    try { setUnread((await readAccountNotifications({ limit: 1 })).unread_count); }
    catch (failure) { onError(failure); }
  }, [onError]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([getAccountUser(controller.signal), getAccountProfile(controller.signal), getAccountSettings(controller.signal)])
      .then(([account, profile, settings]) => { if (!controller.signal.aborted) setIdentity({ user: account.user, profile: profile.profile, settings: settings.settings }); })
      .catch(failure => { if (!isAbort(failure)) { setError(errorMessage(failure)); onError(failure); } });
    return () => controller.abort();
  }, [retry, onError]);
  useEffect(() => { if (identity) void refreshUnread(); }, [identity?.user.id, refreshUnread]);
  useEffect(() => { if (identity) adoptAccountPreference(identity.settings.theme); }, [identity?.settings.theme, adoptAccountPreference]);
  const run = useCallback(async <T,>(action: () => Promise<T>, message?: string): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true);
    try { const value = await action(); if (message) notify(message); return value; }
    catch (failure) { onError(failure); return null; }
    finally { inFlight.current = false; setBusy(false); }
  }, [onError, notify]);
  async function signOut() {
    if (inFlight.current) return;
    const result = await run(logout, "You have logged out successfully.");
    if (result) { router.replace("/login"); router.refresh(); }
  }
  async function changeTheme(theme: ResolvedTheme) {
    const result = await run(() => updateAccountSettings({ theme }));
    if (!result) return false;
    setIdentity(previous => previous ? { ...previous, settings: result.settings } : previous);
    return true;
  }
  if (!identity) return <main className="unavailable-page" aria-live="polite"><Brand /><ThemeToggle />
    {error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => setRetry(value => value + 1)}>Retry <RefreshCw size={15} /></button><Link href="/login">Back to login</Link></>
      : <p>Loading your account…</p>}
  </main>;
  const page = workspacePages[section];
  const profile = identity.profile;
  return <AccountContext.Provider value={{ ...identity, busy, run, onError, notify,
    setProfile: next => setIdentity(previous => previous ? { ...previous, profile: next } : previous),
    setSettings: next => setIdentity(previous => previous ? { ...previous, settings: next } : previous) }}>
    <div className="app-shell account-app">
      <aside className="sidebar">
        <Brand /><div className="workspace-label">YOUR WORKSPACE <span>PERSONAL</span></div>
        <nav aria-label="Primary navigation">{PRIMARY_NAV.map(({ id, label, icon: Icon }) => <Link key={id} href={workspacePages[id].href}
          aria-current={section === id ? "page" : undefined} className={"nav-item " + (section === id ? "selected" : "")}><Icon size={19} /><span>{label}</span></Link>)}</nav>
        <div className="sidebar-utilities">{UTILITY_NAV.map(({ id, label, icon: Icon }) => <Link key={id} href={workspacePages[id].href}
          aria-current={section === id ? "page" : undefined} className={"nav-item " + (section === id ? "selected" : "")}><Icon size={18} /><span>{label}</span></Link>)}</div>
        <div className="sidebar-note"><ShieldCheck size={32} /><h3>Your account.<br />Your next step.</h3><p>Subscriptions, reports and conversations in one place.</p></div>
        <div className="sidebar-bottom"><Link href="/settings" className="profile-button"><Avatar name={profile.display_name} /><span><b>{profile.display_name}</b><small>{identity.user.email}</small></span></Link>
          <button className="help-button" onClick={signOut} disabled={busy}><LogOut size={16} />Log out</button></div>
      </aside>
      <div className="workspace">
        <header className="topbar"><Link href="/" className="header-brand"><Brand compact /><b>RETREST</b></Link>
          <div className="breadcrumb">Workspace <ChevronRight size={13} /><span>{page.label}</span></div>
          <div className="topbar-actions"><span className="live-chip"><ShieldCheck size={13} />Your account</span>
            <ThemeToggle disabled={busy} onChange={changeTheme} />
            <button className="icon-button notification-button" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} onClick={() => setNotifications(true)}><Bell size={19} />{unread > 0 && <i />}</button>
            <Link href="/settings" aria-label="Account settings"><Avatar name={profile.display_name} small /></Link>
            <button className="icon-button" aria-label="Log out" disabled={busy} onClick={signOut}><LogOut size={18} /></button></div>
        </header>
        <main className="main-content"><div className="page-heading"><div><div className="eyebrow">{page.eyebrow}</div><h1>{page.heading}<span>.</span></h1><p>{descriptions[section]}</p></div></div>
          {section === "shield" && <AccountSubscriptions />}{section === "pools" && <AccountPools />}
          {section === "transactions" && <AccountTransactions />}{section === "insights" && <AccountInsights />}
          {section === "settings" && <AccountSettings />}{section === "support" && <AccountSupport />}
          <PageFooter />
        </main>
      </div>
      <nav className="bottom-nav account-bottom-nav" aria-label="Dashboard navigation">{[...PRIMARY_NAV, ...UTILITY_NAV].map(({ id, label, icon: Icon }) => <Link key={id} href={workspacePages[id].href}
        aria-current={section === id ? "page" : undefined} className={"bottom-nav-item " + (section === id ? "selected" : "")}><Icon size={18} /><span>{label}</span></Link>)}</nav>
      {notifications && <AccountNotifications close={() => setNotifications(false)} changed={refreshUnread} unread={unread} />}
    </div>
  </AccountContext.Provider>;
}
