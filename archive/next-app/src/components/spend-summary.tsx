"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Copy, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { Dashboard } from "@/lib/types";
import { money } from "@/lib/format";

export default function SpendSummary({ data, email, notify }: { data: Dashboard; email: string; notify: (text: string, error?: boolean) => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generatedMonth, setGeneratedMonth] = useState<string | null>(null);
  const [recipient, setRecipient] = useState(email);
  const summary = useMemo(() => {
    const rows = data.transactions.filter(transaction => transaction.created_at.slice(0, 7) === generatedMonth);
    const approved = rows.filter(transaction => transaction.status === "APPROVED");
    const blocked = rows.filter(transaction => transaction.status.startsWith("DECLINED"));
    const totals = { NGN: 0, USD: 0 };
    const saved = { NGN: 0, USD: 0 };
    const categories: Record<string, number> = {};
    for (const transaction of approved) {
      totals[transaction.currency] += transaction.amount;
      const category = data.subscriptions.find(subscription => subscription.id === transaction.subscription_id)?.category ?? "Other";
      categories[category] = (categories[category] ?? 0) + (transaction.currency === "USD" ? transaction.amount * data.exchange_rate : transaction.amount);
    }
    for (const transaction of blocked) {
      const expected = data.subscriptions.find(subscription => subscription.id === transaction.subscription_id)?.expected_amount ?? transaction.amount;
      saved[transaction.currency] += transaction.status === "DECLINED_PRICE_HIKE" ? Math.max(0, transaction.amount - expected) : transaction.amount;
    }
    const top = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const monthLabel = generatedMonth ? new Date(generatedMonth + "-01T00:00:00Z").toLocaleDateString("en-GB", {month: "long", year: "numeric", timeZone: "UTC"}) : "";
    const text = "RETREST · " + monthLabel + " spend summary\n\n" +
      "You settled " + approved.length + " payments: " + money(totals.NGN) + " and " + money(totals.USD, "USD") + ".\n" +
      (top.length ? "Your largest category was " + top[0][0] + ".\n" : "No settled payments were recorded for this month.\n") +
      "Your shield blocked " + blocked.length + " attempts, protecting " + money(saved.NGN) + " and " + money(saved.USD, "USD") + " in paused charges and price increases.\n\n" +
      "Demo summary generated from the latest 100 available transactions. Category comparisons use the current simulated NGN/USD rate. Blocked savings are based on current merchant limits.";
    return { totals, saved, top, approved, blocked, monthLabel, text };
  }, [data, generatedMonth]);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());

  return <div className="spend-summary-content">
    <span className="modal-kicker"><Sparkles size={14}/> AI SPEND SUMMARY · DEMO PREVIEW</span>
    <h2>Your month.<br/>A clearer picture<span>.</span></h2>
    <p className="modal-description">Your spending, your biggest categories, and the payments your shield stopped.</p>
    <form className="summary-generate" onSubmit={event => {event.preventDefault();setGeneratedMonth(month);}}>
      <label>Month & year<input aria-label="Summary month" type="month" value={month} min="2020-01" max="2099-12" onChange={event => setMonth(event.target.value)} required/></label>
      <button className="button primary" type="submit"><Sparkles size={15}/> Generate summary</button>
    </form>
    {generatedMonth ? <div className="generated-summary" role="status">
      <div className="summary-month-title"><h3>{summary.monthLabel}</h3><span className="badge green"><CheckCircle2 size={12}/> Ready</span></div>
      <div className="summary-totals"><div><small>NGN SPENT</small><strong>{money(summary.totals.NGN)}</strong></div><div><small>USD SPENT</small><strong>{money(summary.totals.USD, "USD")}</strong></div></div>
      <div className="summary-narrative"><Sparkles size={18}/><p>{summary.approved.length ? <>You made <b>{summary.approved.length} approved payments</b>{summary.top.length ? <>. <b>{summary.top[0][0]}</b> was your largest spending category</> : null}. Your shield checked every charge before funds moved.</> : <>No approved payments this month. Try a month with recorded activity.</>}</p></div>
      {summary.top.length > 0 && <div className="category-breakdown"><div className="eyebrow">TOP CATEGORIES · NGN EQUIVALENT</div>{summary.top.slice(0, 4).map(([category, amount]) => <div key={category}><div><span>{category}</span><b>{money(Math.round(amount))}</b></div><div className="category-bar"><span style={{width: (amount / Math.max(1, summary.top.reduce((sum, [, value]) => sum + value, 0)) * 100) + "%"}}/></div></div>)}</div>}
      <div className="summary-shield-savings"><ShieldCheck size={20}/><div><small>{summary.blocked.length} BLOCKED ATTEMPTS</small><b>{money(summary.saved.NGN)} + {money(summary.saved.USD, "USD")} protected</b></div></div>
      <div className="summary-email"><label>Email recipient<input type="email" aria-label="Summary email recipient" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="you@example.com" required/></label>
        {validEmail ? <a className="button primary full-width" href={"mailto:" + encodeURIComponent(recipient.trim()) + "?subject=" + encodeURIComponent("Your RETREST spend summary · " + summary.monthLabel) + "&body=" + encodeURIComponent(summary.text)}><Mail size={15}/> Send summary to email <ArrowUpRight size={14}/></a> : <button className="button primary full-width" disabled><Mail size={15}/> Enter a valid email address</button>}
        <small>Opens a prepared draft in your email app for you to send.</small>
      </div>
      <button className="text-button summary-copy" onClick={async () => {try {await navigator.clipboard.writeText(summary.text);notify("Spend summary copied.");} catch {notify("Clipboard unavailable. Select the summary to copy it.", true);}}}><Copy size={14}/> Copy summary instead</button>
      <p className="summary-data-note">This demo brief uses recorded payments and a template. Based on the latest 100 available transactions. Categories use the current FX rate; blocked savings use current merchant limits.</p>
    </div> : <div className="summary-empty"><span className="brief-orb"><Sparkles size={29}/></span><h3>A whole month. In a minute.</h3><p>Choose your month to generate a summary from your payment activity.</p></div>}
  </div>;
}
