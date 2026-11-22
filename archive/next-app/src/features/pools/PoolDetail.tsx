"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ShieldCheck, Users } from "lucide-react";
import type { Dashboard, Pool } from "../../lib/types";
import { money } from "../../lib/format";
import { errorMessage } from "../shared/api";
import { loadPoolState, setHostFallback, simulateContribution } from "./api";
import "./styles.css";

export interface PoolDetailProps { pool: Pool; demoEnabled: boolean; onStateChange: (data: Dashboard) => void }

export function PoolDetail({ pool, demoEnabled, onStateChange }: PoolDetailProps) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invitePath = `/invite/${encodeURIComponent(pool.invite_token)}`;
  const progress = pool.target_amount > 0 ? Math.min(100, Math.max(0, pool.pool_balance / pool.target_amount * 100)) : 0;

  async function update(action: () => Promise<Dashboard>, confirmedMessage: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { onStateChange(await action()); setMessage(confirmedMessage); }
    catch (error) {
      setError(errorMessage(error));
      try { onStateChange(await loadPoolState()); } catch { /* Keep the last confirmed state. */ }
    } finally { lock.current = false; setBusy(false); }
  }

  return <section className="fe2-pools"><article className="panel fe2-pool-card" aria-busy={busy}>
    <div className="fe2-pool-heading"><div><span className="eyebrow">{pool.merchant_name}</span><h2>{pool.name}</h2><p>{pool.members.length} members · {pool.currency}</p></div><Users size={23} /></div>
    <div className="fe2-pool-balance"><strong>{money(pool.pool_balance, pool.currency, true)}</strong><span>of {money(pool.target_amount, pool.currency, true)}</span></div>
    <progress aria-label={`${pool.name} funding`} value={progress} max={100} />
    <div className="fe2-pool-renewal"><span>Next renewal</span><time dateTime={pool.next_billing_date}>{new Date(pool.next_billing_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time></div>
    <div className="fe2-pool-member-list">{pool.members.map(member => <div className="fe2-pool-member-status" key={member.id}>
      <div><b>{member.name}{member.user_id === pool.host_user_id ? " · Host" : ""}</b><small>{member.email}</small><small>{money(member.share_amount, pool.currency, true)} share</small></div>
      <span className={`fe2-pool-state state-${member.payment_status.toLowerCase()}`}>{member.payment_status === "PAID" && <CheckCircle2 size={13} />}{member.payment_status === "PAID" ? "Paid · demo" : member.payment_status === "OVERDUE" ? "Overdue" : "Pending"}</span>
      {demoEnabled && member.payment_status !== "PAID" && <button type="button" className="text-button" disabled={busy} onClick={() => update(() => simulateContribution(pool.id, member.id), "Demo contribution confirmed by the server.")} aria-label={`Simulate contribution for ${member.name}`}>Simulate contribution</button>}
    </div>)}</div>
    <div className="fe2-pool-fallback"><ShieldCheck size={19} /><div><b>Host wallet fallback</b><small>Wallet covers the remaining bill after pool funds.</small></div><button type="button" role="switch" aria-label={`Host fallback for ${pool.name}`} aria-checked={!!pool.fallback_enabled} className={`toggle ${pool.fallback_enabled ? "on" : ""}`} disabled={busy} onClick={() => update(() => setHostFallback(pool.id, !pool.fallback_enabled), "Host fallback saved on the server.")}><span /></button></div>
    <div className="fe2-pool-card-actions"><Link href={invitePath} className="button secondary">Open invite</Link><button type="button" className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(new URL(invitePath, location.origin).href); setMessage("Invite link copied."); } catch { setError("Clipboard unavailable. Open the invite and copy its address."); } }}><Copy size={14} />Copy link</button></div>
    <p className="fe2-pool-note">Share editing is not available yet. Contributions in this build are simulated.</p>
    {error && <p className="fe2-pool-error" role="alert">{error}</p>}{message && <p role="status" className="fe2-pool-note">{message}</p>}
  </article></section>;
}

export default PoolDetail;
