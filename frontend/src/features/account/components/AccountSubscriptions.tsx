"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Settings2, ShieldCheck } from "lucide-react";
import { money, shortDate, type CategoryRecord, type Currency, type SubscriptionInput, type SubscriptionRecord } from "@retrest/shared";
import { DialogFrame, EmptyState, MerchantLogo, Toggle } from "@/components/ui";
import { majorAmount, majorToMinor } from "@/lib/money";
import { addAccountSubscription, getCategories, updateAccountSubscription } from "../api";
import { useAccount } from "../AccountContext";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

function SubscriptionEditor({ record, close, saved }: { record: SubscriptionRecord | null; close: () => void; saved: () => Promise<void> }) {
  const { busy, run, onError } = useAccount();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  useEffect(() => { let active = true; getCategories().then(value => { if (active) setCategories(value.data); }).catch(onError); return () => { active = false; }; }, [onError]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run(async () => {
      const body: SubscriptionInput = {
        name: String(form.get("name")).trim(), merchant_descriptor: String(form.get("descriptor")).trim(),
        amount_minor: majorToMinor(form.get("amount")), expected_max_amount: majorToMinor(form.get("limit")),
        currency: form.get("currency") as Currency, billing_cycle: form.get("cycle") as "MONTHLY" | "YEARLY",
        next_billing_date: String(form.get("date")), category_slug: String(form.get("category")) || null,
        is_business_expense: form.get("business") === "on",
      };
      return record ? updateAccountSubscription(record.id, body) : addAccountSubscription(body);
    }, record ? "Subscription updated." : "Subscription saved.");
    if (result) { close(); await saved(); }
  }
  return <DialogFrame label={record ? "Edit subscription" : "Add subscription"} busy={busy} onClose={close}>
    <div className="account-dialog-heading"><span className="eyebrow">YOUR SUBSCRIPTIONS</span><h2>{record ? "Edit subscription" : "Add a subscription"}</h2><p>Set your billing amount, maximum charge and renewal date.</p></div>
    <form onSubmit={submit} className="account-form">
      <div className="form-two"><label>Name<input name="name" defaultValue={record?.name} maxLength={80} required /></label>
        <label>Statement descriptor<input name="descriptor" defaultValue={record?.merchant_descriptor ?? ""} maxLength={100} required /></label></div>
      <div className="form-two"><label>Expected amount<input name="amount" type="number" min="0.01" max="10000000000" step="0.01" defaultValue={record ? majorAmount(record.amount_minor) : ""} required /></label>
        <label>Maximum charge<input name="limit" type="number" min="0.01" max="10000000000" step="0.01" defaultValue={record ? majorAmount(record.expected_max_amount) : ""} required /></label></div>
      <div className="form-two"><label>Currency<select name="currency" defaultValue={record?.currency ?? "NGN"}><option>NGN</option><option>USD</option></select></label>
        <label>Billing cycle<select name="cycle" defaultValue={record?.billing_cycle ?? "MONTHLY"}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label></div>
      <div className="form-two"><label>Next renewal<input type="date" name="date" defaultValue={record?.next_billing_date ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)} required /></label>
        <label>Category<select name="category" defaultValue={record?.category_slug ?? ""}><option value="">Uncategorised</option>{categories.map(category => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label></div>
      <label className="checkbox-label"><input type="checkbox" name="business" defaultChecked={record?.is_business_expense} />Business expense</label>
      <button className="button primary full-width" disabled={busy}><ShieldCheck size={16} />Save subscription</button>
    </form>
  </DialogFrame>;
}

export function AccountSubscriptions() {
  const { busy, run, onError } = useAccount();
  const [active, setActive] = useState("all");
  const [currency, setCurrency] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SubscriptionRecord | null | undefined>(undefined);
  const list = useAccountPage<SubscriptionRecord>("subscriptions", { active: active === "all" ? undefined : active === "active", currency: currency || undefined }, onError);
  const visible = list.rows.filter(row => `${row.name} ${row.merchant_descriptor ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  async function toggle(record: SubscriptionRecord) {
    const saved = await run(() => updateAccountSubscription(record.id, { active: !record.active }), record.active ? "Subscription paused." : "Subscription activated.");
    if (saved) await list.refresh();
  }
  return <>
    <section className="panel subscriptions-panel"><div className="section-header"><div><h2>Your subscriptions</h2><p>Saved merchant limits and billing preferences.</p></div>
      <button className="button primary" onClick={() => setEditing(null)}><Plus size={16} />Add subscription</button></div>
      <div className="account-toolbar"><label>Status<select aria-label="Subscription status" value={active} onChange={event => setActive(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
        <label>Currency<select aria-label="Subscription currency" value={currency} onChange={event => setCurrency(event.target.value)}><option value="">All currencies</option><option>NGN</option><option>USD</option></select></label>
        <label>Search loaded subscriptions<input aria-label="Search subscriptions" value={search} onChange={event => setSearch(event.target.value)} placeholder="Merchant name" /></label></div>
      <div className="table-scroll"><table className="subscription-table account-table"><thead><tr><th>SUBSCRIPTION</th><th>NEXT RENEWAL</th><th>AMOUNT / LIMIT</th><th>STATUS</th><th /></tr></thead>
        <tbody>{visible.map(record => <tr key={record.id}><td><div className="merchant-cell"><MerchantLogo name={record.name} /><span><b>{record.name}</b><small>{record.category_slug ?? "Uncategorised"}{record.is_business_expense ? " · Business" : ""}</small></span></div></td>
          <td>{record.next_billing_date ? shortDate(record.next_billing_date) : "Not set"}<small>{record.billing_cycle === "YEARLY" ? "Yearly" : "Monthly"}</small></td>
          <td><b>{money(record.amount_minor, record.currency)}</b><small>Max {money(record.expected_max_amount, record.currency)}</small></td>
          <td><div className="shield-cell"><Toggle on={record.active} disabled={busy} label={`${record.active ? "Pause" : "Activate"} ${record.name}`} onClick={() => void toggle(record)} /><span>{record.active ? "Active" : "Paused"}</span></div></td>
          <td><button className="icon-button" aria-label={`Edit ${record.name}`} onClick={() => setEditing(record)}><Settings2 size={17} /></button></td></tr>)}</tbody></table></div>
      {!visible.length && !list.loading && !list.error && <EmptyState text={search ? "No loaded subscriptions match your search." : "Add your first subscription to get started."} />}
      <AccountListStatus {...list} count={list.rows.length} more={list.cursor ? list.more : undefined} />
    </section>
    <section className="panel account-service-note"><ShieldCheck size={22} /><div><h3>Your preferences are saved</h3><p>Card issuance and wallet funding will become available when the payment service is connected.</p></div></section>
    {editing !== undefined && <SubscriptionEditor record={editing} close={() => setEditing(undefined)} saved={list.refresh} />}
  </>;
}
