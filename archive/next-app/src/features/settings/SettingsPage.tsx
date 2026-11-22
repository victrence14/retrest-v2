"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CreditCard, ShieldCheck, Zap } from "lucide-react";
import type { Dashboard, User } from "../../lib/types";
import { money } from "../../lib/format";
import { errorMessage } from "../shared/api";
import { loadSettingsState, setAutoFxPreference } from "./api";
import "./styles.css";

export interface SettingsPageProps {
  user: User;
  busy?: boolean;
  onStateChange?: (data: Dashboard) => void;
  /** Optional existing shell mutation; must resolve after its request completes. */
  requestAutoFx?: () => Promise<unknown>;
  /** FE1 supplies its shared components here; FE2 does not duplicate account actions. */
  profile?: ReactNode;
  accountActions?: ReactNode;
  variant?: "page" | "preferences";
}

export function SettingsPage({ user, busy: externalBusy = false, onStateChange, requestAutoFx, profile, accountActions, variant = "page" }: SettingsPageProps) {
  const [confirmedUser, setConfirmedUser] = useState(user);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { if (!lock.current) setConfirmedUser(user); }, [user]);

  async function toggle() {
    if (lock.current || externalBusy) return;
    lock.current = true; setBusy(true); setMessage(""); setError("");
    const requested = !confirmedUser.auto_fx_enabled;
    try {
      let state: Dashboard;
      if (requestAutoFx) { await requestAutoFx(); state = await loadSettingsState(); }
      else state = await setAutoFxPreference(requested);
      setConfirmedUser(state.user); onStateChange?.(state);
      if (!!state.user.auto_fx_enabled !== requested) throw new Error("The server did not confirm this preference change. Please try again.");
      setMessage("Auto-conversion preference saved on the server.");
    } catch (error) {
      setError(errorMessage(error));
      try { const state = await loadSettingsState(); setConfirmedUser(state.user); onStateChange?.(state); } catch { /* Preserve the last confirmed preference. */ }
    } finally { lock.current = false; setBusy(false); }
  }

  return <div className="fe2-settings">
    {variant === "page" && profile}
    <section className="panel account-panel" aria-busy={busy || externalBusy}>
      <div className="section-header"><div><h2><Zap size={18} />Your money preferences</h2><p>Confirmed settings from your demo account.</p></div><span className="badge neutral">Server saved</span></div>
      <div className="account-preference"><span className="icon-well"><Zap size={17} /></span><div><b>Just-in-time dollar conversion</b><p>Convert the exact USD shortfall from your NGN wallet when a subscription charges.</p></div><button type="button" role="switch" aria-checked={!!confirmedUser.auto_fx_enabled} aria-label="Automatic NGN to USD conversion" className={`toggle ${confirmedUser.auto_fx_enabled ? "on" : ""}`} disabled={busy || externalBusy} onClick={toggle}><span /></button></div>
      <div className="account-balance-pair"><div><span><CreditCard size={14} />NGN wallet</span><strong>{money(confirmedUser.ngn_balance)}</strong></div><div><span><CreditCard size={14} />USD wallet</span><strong>{money(confirmedUser.usd_balance, "USD", true)}</strong></div></div>
      <p className="fe2-settings-note">This preference survives reloads through the server. Currency conversion and payments are simulated in this build.</p>
      {message && <p role="status" className="fe2-settings-note">{message}</p>}{error && <p role="alert" className="fe2-settings-error">{error}</p>}
    </section>
    {variant === "page" && <><section className="panel fe2-settings-unavailable"><ShieldCheck size={21} /><div><h2>Account management is awaiting integration.</h2><p>Phone/preferences, confirmed email changes and trusted-device revocation are not connected to this demo’s server. The existing account screens are previews.</p></div></section>{accountActions}</>}
  </div>;
}

export default SettingsPage;
