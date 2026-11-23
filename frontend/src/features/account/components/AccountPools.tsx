"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { money, type InviteRecord, type PoolMemberRecord, type PoolRecord, type SubscriptionRecord } from "@retrest/shared";
import { DialogFrame, EmptyState, Toggle } from "@/components/ui";
import { useClipboard } from "@/hooks/useClipboard";
import { addAccountPool, createAccountInvite, getAccountPool, revokeAccountInvite, updateAccountPool } from "../api";
import { useAccount } from "../AccountContext";
import { useAccountPage } from "../useAccountPage";
import { usePoolContribution } from "../usePoolContribution";
import { AccountListStatus } from "./AccountListStatus";

function PoolCreator({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const { user, profile, run, busy, onError } = useAccount();
  const subscriptions = useAccountPage<SubscriptionRecord>("subscriptions", { active: true, limit: 100 }, onError);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [members, setMembers] = useState([{ key: 1, name: "", email: "" }]);
  const nextKey = useRef(2);
  const subscription = subscriptions.rows.find(row => row.id === subscriptionId && row.user_id === user.id);
  const count = members.length + 1;
  const total = BigInt(subscription?.amount_minor ?? 0);
  const shares = Array.from({ length: count }, (_, index) => Number(total / BigInt(count) + (BigInt(index) < total % BigInt(count) ? 1n : 0n)));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription) return;
    const form = new FormData(event.currentTarget);
    const result = await run(() => addAccountPool({
      subscription_id: subscription.id, name: String(form.get("pool_name")).trim(), fallback_enabled: form.get("fallback") === "on",
      members: [{ display_name: profile.display_name, email: user.email, share_amount: shares[0] },
        ...members.map((member, index) => ({ display_name: member.name.trim(), email: member.email.trim().toLowerCase(), share_amount: shares[index + 1] }))],
    }), "Pool created. Invite your members to join.");
    if (result) { close(); await saved(); }
  }
  return <DialogFrame label="Create a pool" busy={busy} onClose={close}>
    <div className="account-dialog-heading"><span className="eyebrow">BETTER TOGETHER</span><h2>Create a pool</h2><p>Split the subscription equally with up to 20 members, including you.</p></div>
    <form className="account-form" onSubmit={submit}>
      <label>Pool name<input name="pool_name" maxLength={80} required /></label>
      <label>Subscription<select value={subscriptionId} onChange={event => setSubscriptionId(event.target.value)} required>
        <option value="">Choose a subscription</option>{subscriptions.rows.filter(row => row.user_id === user.id).map(row => <option key={row.id} value={row.id}>{row.name} · {money(row.amount_minor, row.currency)}</option>)}</select></label>
      {subscriptions.cursor && <button type="button" className="text-button" disabled={subscriptions.loading} onClick={() => void subscriptions.more()}>Load more subscriptions</button>}
      {subscriptions.error && <p className="form-error">{subscriptions.error}</p>}
      <div className="account-member-row"><span><b>{profile.display_name}</b><small>{user.email} · Host</small></span><b>{subscription ? money(shares[0], subscription.currency) : "—"}</b></div>
      {members.map((member, index) => <div className="account-member-form" key={member.key}>
        <div className="form-two"><label>Member name<input value={member.name} maxLength={80} onChange={event => setMembers(previous => previous.map(item => item.key === member.key ? { ...item, name: event.target.value } : item))} required /></label>
          <label>Member email<input type="email" value={member.email} maxLength={254} onChange={event => setMembers(previous => previous.map(item => item.key === member.key ? { ...item, email: event.target.value } : item))} required /></label></div>
        <div className="account-member-row"><span>Share: {subscription ? money(shares[index + 1], subscription.currency) : "—"}</span>
          {members.length > 1 && <button type="button" className="text-button" onClick={() => setMembers(previous => previous.filter(item => item.key !== member.key))}>Remove member</button>}</div>
      </div>)}
      {count < 20 && <button type="button" className="button secondary" onClick={() => setMembers(previous => [...previous, { key: nextKey.current++, name: "", email: "" }])}><Plus size={15} />Add member</button>}
      <label className="checkbox-label"><input type="checkbox" name="fallback" defaultChecked />Allow host fallback</label>
      {subscription && subscription.amount_minor < count && <p className="form-error">Each member needs a positive share.</p>}
      <button className="button primary full-width" disabled={busy || !subscription || subscription.amount_minor < count}>Create pool</button>
    </form>
  </DialogFrame>;
}

function PoolDetails({ record, close, changed }: { record: PoolRecord; close: () => void; changed: () => Promise<void> }) {
  const { user, run, busy, notify, onError } = useAccount();
  const { copy } = useClipboard(notify);
  const [detail, setDetail] = useState<{ pool: PoolRecord; members: PoolMemberRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Record<string, { invite: InviteRecord; url: string }>>({});
  const payment = usePoolContribution(user.id, record.id, run, onError);
  const contribution = payment.contribution;
  const pool = detail?.pool ?? record;
  const host = pool.host_user_id === user.id;
  useEffect(() => {
    let active = true;
    getAccountPool(record.id).then(result => { if (active) setDetail(result); })
      .catch(failure => { if (active) onError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [record.id, onError]);
  async function refresh() { const result = await run(() => getAccountPool(record.id)); if (result) setDetail(result); }
  async function update(body: { fallback_enabled?: boolean; status?: "ACTIVE" | "CLOSED" }) {
    const result = await run(() => updateAccountPool(pool.id, body), "Pool updated.");
    if (result) { setDetail(previous => ({ pool: result.pool, members: previous?.members ?? [] })); await changed(); }
  }
  async function invite(member: PoolMemberRecord) {
    const result = await run(() => createAccountInvite(pool.id, member.id), "Invitation created.");
    if (!result) return;
    if (!/^\/invite\/[A-Za-z0-9_-]{43}$/.test(result.path)) { notify("The server returned an invalid invitation link.", true); return; }
    setInvites(previous => ({ ...previous, [member.id]: { invite: result.invite, url: window.location.origin + result.path } }));
  }
  async function checkContribution() {
    const result = await payment.check();
    if (result) { await refresh(); await changed(); }
  }
  return <DialogFrame label={pool.name} busy={busy} onClose={close}>
    <div className="account-dialog-heading"><span className="eyebrow">{host ? "YOUR HOSTED POOL" : "YOUR SHARED POOL"}</span><h2>{pool.name}</h2><p>Confirmed balance {money(pool.balance_minor, pool.currency)} · Target {money(pool.target_amount, pool.currency)}</p></div>
    <div className="account-toolbar"><span className="badge neutral">{pool.status}</span><button className="button secondary" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={14} />Refresh members</button></div>
    {loading && <p aria-live="polite">Loading members…</p>}
    {host && <div className="account-pool-controls"><label className="account-member-row">Host fallback<Toggle on={pool.fallback_enabled} disabled={busy || loading} label="Host fallback" onClick={() => void update({ fallback_enabled: !pool.fallback_enabled })} /></label>
      <button className="text-button" disabled={busy || loading} onClick={() => void update({ status: pool.status === "ACTIVE" ? "CLOSED" : "ACTIVE" })}>{pool.status === "ACTIVE" ? "Close pool" : "Reopen pool"}</button></div>}
    {detail?.members.map(member => <div className="account-pool-member" key={member.id}><div className="account-member-row"><span><b>{member.display_name}</b><small>{member.invited_email} · {member.accepted_at ? "Joined" : "Invitation needed"}</small></span>
      <span><b>{money(member.share_amount, pool.currency)}</b><small>{member.payment_status === "PAID" ? "Paid" : "Unpaid"}</small></span></div>
      {host && !member.accepted_at && <button className="text-button" disabled={busy || pool.status !== "ACTIVE"} onClick={() => void invite(member)}>{invites[member.id] ? "Rotate invitation link" : "Create invitation link"}</button>}
      {invites[member.id] && <div className="account-invite-link"><input readOnly aria-label={`Invite link for ${member.display_name}`} value={invites[member.id].url} /><button className="button secondary" onClick={() => void copy(invites[member.id].url)}>Copy</button>
        <button className="text-button" disabled={busy} onClick={async () => { const result = await run(() => revokeAccountInvite(invites[member.id].invite.id), "Invitation revoked."); if (result) setInvites(previous => { const next = { ...previous }; delete next[member.id]; return next; }); }}>Revoke</button></div>}
      {member.user_id === user.id && member.accepted_at && member.payment_status !== "PAID" && pool.status === "ACTIVE" && (!contribution || contribution.status === "FAILED") && <button className="button primary" disabled={busy || payment.loading} onClick={() => void payment.request()}>{contribution ? "Retry failed contribution" : "Request my contribution"}</button>}
    </div>)}
    {contribution && <div className="account-service-note"><div><h3>Contribution: {contribution.status}</h3><p>{contribution.status === "PENDING" ? "Your share is recorded. Funds appear after payment confirmation." : contribution.status === "SETTLED" ? "Your contribution has been confirmed." : "This contribution failed."}</p>
      <button className="text-button" disabled={busy} onClick={() => void checkContribution()}>Check contribution status</button></div></div>}
  </DialogFrame>;
}

export function AccountPools() {
  const { onError } = useAccount();
  const list = useAccountPage<PoolRecord>("pools", {}, onError);
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<PoolRecord | null>(null);
  return <><section className="panel"><div className="section-header"><div><h2>Your pools</h2><p>Hosted pools and those you have joined.</p></div><button className="button primary" onClick={() => setCreate(true)}><Plus size={16} />Create a pool</button></div>
    <div className="account-pool-grid">{list.rows.map(pool => <button className="account-pool-card" key={pool.id} onClick={() => setSelected(pool)}><Users size={24} /><h3>{pool.name}</h3><p>{money(pool.balance_minor, pool.currency)} confirmed</p><small>Target {money(pool.target_amount, pool.currency)} · {pool.status}</small><span className="text-button">View members and invitations →</span></button>)}</div>
    {!list.rows.length && !list.loading && !list.error && <EmptyState text="Create a pool or accept an invitation to get started." />}
    <AccountListStatus {...list} count={list.rows.length} more={list.cursor ? list.more : undefined} />
  </section>{create && <PoolCreator close={() => setCreate(false)} saved={list.refresh} />}{selected && <PoolDetails key={selected.id} record={selected} close={() => setSelected(null)} changed={list.refresh} />}</>;
}
