"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import type { Dashboard } from "../../lib/types";
import { money } from "../../lib/format";
import { FeatureApiError, errorMessage } from "../shared/api";
import { majorAmount, parseMinorAmount, sumMinorAmounts } from "../shared/money";
import { createPool, loadPoolState, type CreatePoolResult } from "./api";
import { equalShares, validatePool, type MemberDraft } from "./shares";
import "./styles.css";

export interface PoolEditorProps {
  data: Dashboard;
  initialSubscriptionId?: string;
  onCreated: (result: CreatePoolResult) => void;
  onCancel?: () => void;
}

export function PoolEditor({ data, initialSubscriptionId, onCreated, onCancel }: PoolEditorProps) {
  const id = useId();
  const available = data.subscriptions.filter(subscription => subscription.user_id === data.user.id && !data.pools.some(pool => pool.subscription_id === subscription.id));
  const [subscriptionId, setSubscriptionId] = useState(initialSubscriptionId ?? available[0]?.id ?? "");
  const subscription = available.find(item => item.id === subscriptionId) ?? available[0];
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [fallback, setFallback] = useState(true);
  const [members, setMembers] = useState<MemberDraft[]>([
    { key: "host", name: data.user.name, email: data.user.email, amount: "" },
    { key: "member-1", name: "", email: "", amount: "" },
  ]);
  const nextMember = useRef(2);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [needsRecheck, setNeedsRecheck] = useState(false);
  let equal: number[] = [];
  if (subscription) {
    try { equal = equalShares(subscription.expected_amount, members.length); } catch { /* Validation explains this amount. */ }
  }
  const entered = mode === "equal" ? equal : members.map(member => parseMinorAmount(member.amount));
  const total = entered.some(value => value == null) ? null : sumMinorAmounts(entered as number[]);

  function updateMember(key: string, field: "name" | "email" | "amount", value: string) {
    setMembers(previous => previous.map(member => member.key === key ? { ...member, [field]: value } : member));
    setErrors({});
  }

  async function recheck() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setServerError("");
    try {
      const state = await loadPoolState();
      const confirmed = state.pools.find(pool => pool.subscription_id === subscription?.id);
      if (confirmed) onCreated({ state, invite_token: confirmed.invite_token });
      else { setNeedsRecheck(false); setServerError("No pool was created for this plan. You can safely submit again."); }
    } catch (error) { setServerError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || needsRecheck) return;
    const validation = validatePool({ subscription, name, members, mode, host: data.user, fallback });
    if (!validation.ok) { setErrors(validation.errors); return; }
    lock.current = true; setBusy(true); setErrors({}); setServerError("");
    try { onCreated(await createPool(validation.payload)); }
    catch (error) {
      setServerError(errorMessage(error));
      // An interrupted response may have followed a committed write. Reconcile before retrying.
      if (!(error instanceof FeatureApiError) || error.status === 0 || error.status >= 500 || error.status === 409) setNeedsRecheck(true);
    } finally { lock.current = false; setBusy(false); }
  }

  if (!available.length) return <section className="fe2-pools"><div className="fe2-pool-empty"><Users size={30} /><h2>Every plan already has a pool.</h2><p>Add a subscription to create another shared plan.</p>{onCancel && <button className="button secondary" onClick={onCancel}>Back to pools</button>}</div></section>;

  return <section className="fe2-pools" aria-label="Pool creation">
    <form className="fe2-pool-editor" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="fe2-pool-heading"><div><span className="eyebrow">GOOD PLANS ARE BETTER TOGETHER</span><h2>Create a shared plan.</h2><p>Every share is saved in exact kobo or cents.</p></div><Users size={25} /></div>
      <fieldset disabled={busy || needsRecheck}>
        <div className="fe2-pool-fields">
          <label htmlFor={`${id}-plan`}>Eligible subscription<select id={`${id}-plan`} value={subscription?.id ?? ""} onChange={event => { setSubscriptionId(event.target.value); setErrors({}); }}>
            {available.map(item => <option key={item.id} value={item.id}>{item.merchant_name} · {money(item.expected_amount, item.currency, true)}</option>)}
          </select></label>
          <label htmlFor={`${id}-name`}>Pool name<input id={`${id}-name`} name="pool_name" value={name} maxLength={60} required onChange={event => setName(event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-error` : undefined} />{errors.name && <small id={`${id}-name-error`} className="fe2-pool-error">{errors.name}</small>}</label>
        </div>
        <div className="fe2-pool-allocation" role="group" aria-label="Share allocation">
          {(["equal", "custom"] as const).map(value => <label key={value}><input type="radio" name={`${id}-allocation`} checked={mode === value} onChange={() => { if (value === "custom") setMembers(previous => previous.map((member, index) => ({ ...member, amount: equal[index] == null ? "" : majorAmount(equal[index]) }))); setMode(value); setErrors({}); }} />{value === "equal" ? "Equal shares" : "Custom shares"}</label>)}
        </div>
        {mode === "equal" && <p className="fe2-pool-note">Any extra {subscription?.currency === "USD" ? "cents" : "kobo"} go to members in the order listed below.</p>}
        <div className="fe2-pool-members-editor">
          {members.map((member, index) => <div className="fe2-pool-member-editor" key={member.key}>
            <span className="fe2-pool-member-number">{index + 1}{index === 0 && <small>HOST</small>}</span>
            <label htmlFor={`${id}-${member.key}-name`}>Name<input id={`${id}-${member.key}-name`} value={member.name} maxLength={60} required onChange={event => updateMember(member.key, "name", event.target.value)} aria-invalid={!!errors[`${member.key}-name`]} /></label>
            <label htmlFor={`${id}-${member.key}-email`}>Email<input id={`${id}-${member.key}-email`} type="email" value={member.email} readOnly={index === 0} autoComplete={index === 0 ? "email" : "off"} required onChange={event => updateMember(member.key, "email", event.target.value)} aria-invalid={!!errors[`${member.key}-email`]} /></label>
            <label htmlFor={`${id}-${member.key}-share`}>{subscription?.currency} share<input id={`${id}-${member.key}-share`} type="text" inputMode="decimal" value={mode === "equal" ? (equal[index] == null ? "" : majorAmount(equal[index])) : member.amount} readOnly={mode === "equal"} required onChange={event => updateMember(member.key, "amount", event.target.value)} aria-invalid={!!errors[`${member.key}-amount`]} /></label>
            {index > 0 && <button type="button" className="icon-button" aria-label={`Remove member ${index + 1}`} disabled={members.length <= 2} onClick={() => { setMembers(previous => previous.filter(item => item.key !== member.key)); setErrors({}); }}><Trash2 size={16} /></button>}
          </div>)}
        </div>
        <button type="button" className="text-button" disabled={members.length >= 10} onClick={() => { setMembers(previous => [...previous, { key: `member-${nextMember.current++}`, name: "", email: "", amount: "" }]); setErrors({}); }}><Plus size={15} /> Add member</button>
        <div className="fe2-pool-total" data-balanced={total === subscription?.expected_amount}><span>Allocated</span><b>{total == null ? "Enter valid shares" : money(total, subscription?.currency, true)} / {money(subscription?.expected_amount ?? 0, subscription?.currency, true)}</b></div>
        <label className="fe2-pool-fallback-option"><input type="checkbox" checked={fallback} onChange={event => setFallback(event.target.checked)} /><span><b>Host wallet fallback</b><small>Let your wallet cover a shortfall after pool funds are used.</small></span></label>
      </fieldset>
      {!!Object.keys(errors).length && <div role="alert" className="fe2-pool-error"><ul>{Object.entries(errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul></div>}
      {serverError && <p className="fe2-pool-error" role="alert">{serverError}</p>}
      {needsRecheck && <button type="button" className="button secondary" onClick={recheck} disabled={busy}>{busy ? "Checking…" : "Recheck server state before retrying"}</button>}
      <div className="fe2-pool-editor-actions">{onCancel && <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button>}<button className="button primary" disabled={busy || needsRecheck} type="submit">{busy ? "Confirming…" : "Create pool & get invite link"}<ArrowRight size={15} /></button></div>
    </form>
  </section>;
}

export default PoolEditor;
