"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, Users } from "lucide-react";
import { money, type AccountInvite, type AccountUser } from "@retrest/shared";
import { Brand } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { ApiError, errorMessage, isAbort } from "@/lib/api/client";
import { acceptAccountInvite, getAccountInvite, getAccountUser } from "../api";
import { usePoolContribution } from "../usePoolContribution";
import "../styles.css";

function Invitation({ token, initial, user }: { token: string; initial: AccountInvite; user: AccountUser }) {
  const { notify } = useToast();
  const router = useRouter();
  const [invite, setInvite] = useState(initial);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const onError = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      notify("Log in with your invited email address to continue.", true);
      router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    }
    else if (!isAbort(failure)) notify(errorMessage(failure), true);
  }, [router, token, notify]);
  const run = useCallback(async <T,>(action: () => Promise<T>, message?: string): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true; setBusy(true);
    try { const result = await action(); if (message) notify(message); return result; }
    catch (failure) { onError(failure); return null; }
    finally { lock.current = false; setBusy(false); }
  }, [onError, notify]);
  const payment = usePoolContribution(user.id, invite.pool.id, run, onError);
  async function accept() { const result = await run(() => acceptAccountInvite(token), "You have joined the pool."); if (result) setInvite(result); }
  async function refresh() { const result = await run(() => getAccountInvite(token)); if (result) setInvite(result); }
  async function check() { if (await payment.check()) await refresh(); }
  const joined = !!invite.member.accepted_at;
  const paid = invite.member.payment_status === "PAID";
  const available = invite.pool.status === "ACTIVE" && !invite.invite.revoked_at && Date.parse(invite.invite.expires_at) > Date.now();
  return <section className="panel account-invite-card"><span className="account-invite-icon"><Users size={28} /></span><div className="eyebrow">YOUR SHARED PLAN</div><h1>{invite.pool.name}</h1>
    <p>You’re invited as <b>{invite.member.display_name}</b> using {invite.member.invited_email}.</p>
    <div className="account-invite-amount"><span>Your share</span><strong>{money(invite.member.share_amount, invite.pool.currency)}</strong><small>Pool target {money(invite.pool.target_amount, invite.pool.currency)}</small></div>
    {joined ? <p className="account-note"><CheckCircle2 size={16} />You’ve joined this pool.{paid ? " Your contribution is confirmed." : " Your contribution is unpaid."}</p>
      : <><p className="account-note">Invitation expires {new Date(invite.invite.expires_at).toLocaleString()}. Acceptance records your membership.</p><button className="button primary full-width" disabled={busy || !available} onClick={() => void accept()}>Accept invitation</button></>}
    {!available && <p className="form-error" role="alert">This invitation is expired, revoked, or the pool is closed. Ask the host for an active invitation.</p>}
    {joined && !paid && available && (!payment.contribution || payment.contribution.status === "FAILED") && <button className="button primary full-width" disabled={busy || payment.loading} onClick={() => void payment.request()}>{payment.contribution ? "Retry failed contribution" : "Request my contribution"}</button>}
    {payment.contribution && <div className="account-contribution-status" aria-live="polite"><b>Contribution: {payment.contribution.status}</b><p>{payment.contribution.status === "PENDING" ? "Your request is recorded. Funds appear after payment confirmation." : payment.contribution.status === "SETTLED" ? "Your payment has been confirmed." : "This contribution failed. You can request another attempt."}</p>
      <button className="text-button" disabled={busy} onClick={() => void check()}>Check contribution status</button></div>}
    <div className="account-actions"><button className="button secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} />Refresh</button><Link className="button secondary" href="/pools">Open my pools</Link></div>
  </section>;
}

export function AccountInvitePage({ token }: { token: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [data, setData] = useState<{ invite: AccountInvite; user: AccountUser } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([getAccountInvite(token, controller.signal), getAccountUser(controller.signal)])
      .then(([invite, account]) => { if (!controller.signal.aborted) setData({ invite, user: account.user }); })
      .catch(failure => {
        if (isAbort(failure)) return;
        if (failure instanceof ApiError && failure.status === 401) router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        else { const message = errorMessage(failure); setError(message); notify(message, true); }
      });
    return () => controller.abort();
  }, [token, retry, router, notify]);
  return <main className="account-invite-page"><header className="page-appearance-header"><Link href="/" aria-label="RETREST home"><Brand /></Link><ThemeToggle /></header>
    {data ? <Invitation token={token} initial={data.invite} user={data.user} /> : <section className="panel account-invite-card" aria-live="polite">{error ? <><h1>Invitation unavailable</h1><p role="alert">{error}</p><p>Check that you’re signed in with the invited email address.</p><button className="button secondary" onClick={() => setRetry(value => value + 1)}>Retry</button><Link className="text-button" href="/pools">Open my pools →</Link></> : <p>Loading invitation…</p>}</section>}
  </main>;
}
