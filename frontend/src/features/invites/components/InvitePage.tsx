"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Users, ShieldCheck, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { inviteReturnPath, submitDemoContribution } from "../api";
import "../styles.css";

/** Props supplied by the implemented server-rendered invitation lookup. */
export interface InvitePageProps { token: string; name: string; host: string; merchant: string; amount: string; date: string; demo: boolean }

export function InvitePage({ token, name, host, merchant, amount, date, demo }: InvitePageProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function contribute(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (lock.current || !demo) return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError("Enter the email your host added to this pool."); return; }
    lock.current = true; setBusy(true); setError("");
    try { const confirmed = await submitDemoContribution(token, address); setEmail(address); setResult(confirmed.message); }
    catch (error) { setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section className="fe2-invites panel invite-public-card" aria-label="Pool invitation" aria-busy={busy}>
    <span className="success-circle"><Users size={27} /></span>
    <div className="eyebrow">YOU’RE INVITED</div>
    <h1>{name}<span>.</span></h1>
    <p>{host} invited you to split {merchant}.</p>
    <div className="merchant-info"><span>Plan total<b>{amount}/month</b></span><span>Next renewal<b>{date}</b></span></div>
    <p className="fe2-invite-disclosure">{demo ? "Demo contribution only. Entering an email checks the invite list; it does not verify account ownership or move real money." : "Live contributions are not connected. Your invitation is preserved while payment setup is completed."}</p>
    {result ? <div className="invite-success" role="status"><CheckCircle2 size={22} /><p>{result}</p></div> : <form onSubmit={contribute} noValidate>
      <label htmlFor={`${id}-email`}>Your invited email address<input id={`${id}-email`} type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} readOnly={busy} onChange={event => { setEmail(event.target.value); setError(""); }} aria-invalid={!!error} aria-describedby={`${id}-hint`} /></label>
      <small id={`${id}-hint`}>If this address is not listed, ask your host to check the invitation.</small>
      <button className="button primary full-width" disabled={busy || !demo}>{busy ? "Confirming with the server…" : demo ? (error ? "Retry demo contribution" : "Simulate my contribution") : "Contributions available after provider setup"}<ArrowRight size={15} /></button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <button type="button" className="text-button" disabled={busy} onClick={() => contribute()}><RefreshCw size={14} />{busy ? "Checking…" : "Recheck demo contribution"}</button>}
    <Link href={inviteReturnPath(token)} className="button secondary full-width fe2-invite-login">Open login and return to this invite<ArrowRight size={14} /></Link>
    <small className="fe2-invite-note">Login is an account preview in this build. Verified acceptance, expiry, and revocation need the live invitation service.</small>
    <span className="invite-shield"><ShieldCheck size={15} />One card. Shared plans. Protected payments.</span>
    <Link href="/" className="text-button">Go to RETREST<ArrowRight size={14} /></Link>
  </section>;
}

export default InvitePage;
