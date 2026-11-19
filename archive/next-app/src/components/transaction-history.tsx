"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, FileText, Search, ShieldOff, Wallet } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import type { Transaction, User } from "@/lib/types";

export default function TransactionHistory({ user, transactions }: { user: User; transactions: Transaction[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const approved = transactions.filter(transaction => transaction.status === "APPROVED");
  const blocked = transactions.filter(transaction => transaction.status !== "APPROVED");
  const filtered = transactions.filter(transaction => {
    const matchesStatus = status === "all" || (status === "approved" ? transaction.status === "APPROVED" : transaction.status !== "APPROVED");
    const matchesCurrency = currency === "all" || transaction.currency === currency;
    const matchesSearch = (transaction.merchant_name + " " + (transaction.decline_reason ?? "")).toLowerCase().includes(search.toLowerCase().trim());
    const matchesPeriod = period === "all" || Date.now() - new Date(transaction.created_at).getTime() <= Number(period) * 86400000;
    return matchesStatus && matchesCurrency && matchesSearch && matchesPeriod;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return <>
    <div className="history-summary">
      <section className="panel history-stat"><span><Wallet size={16} /> NGN wallet</span><strong>{money(user.ngn_balance)}</strong><small>Current demo balance</small></section>
      <section className="panel history-stat"><span><CreditCard size={16} /> USD wallet</span><strong>{money(user.usd_balance, "USD", true)}</strong><small>Ready for dollar subscriptions</small></section>
      <section className="panel history-stat"><span><CheckCircle2 size={16} /> Approved payments</span><strong>{approved.length}<i>payments</i></strong><small>Every settled payment has a receipt</small></section>
      <section className="panel history-stat"><span><ShieldOff size={16} /> Blocked attempts</span><strong>{blocked.length}<i>blocks</i></strong><small>Your rules kept these funds safe</small></section>
    </div>
    <section className="panel history-panel">
      <div className="section-header"><div><h2>Payment history <span className="count-badge">{transactions.length}</span></h2><p>Approved charges and blocked attempts, together.</p></div><Link href="/insights" className="text-button">Business receipts <ArrowUpRight size={14} /></Link></div>
      <div className="history-toolbar">
        <div className="segmented" aria-label="Filter transactions by status">
          {[["all", "All activity"], ["approved", "Approved"], ["blocked", "Blocked"]].map(([value, label]) => <button key={value} type="button"
            className={status === value ? "selected" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}
        </div>
        <div className="history-filters">
          <label className="history-search"><Search size={15} /><input aria-label="Search transactions" placeholder="Find a payment" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
          <select aria-label="Transaction currency" value={currency} onChange={event => { setCurrency(event.target.value); setPage(1); }}><option value="all">All currencies</option><option value="NGN">NGN</option><option value="USD">USD</option></select>
          <select aria-label="Transaction period" value={period} onChange={event => { setPeriod(event.target.value); setPage(1); }}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        </div>
      </div>
      <div className="table-scroll">
        <table className="history-table"><thead><tr><th>PAYMENT</th><th>DATE</th><th>AMOUNT</th><th>DECISION</th><th>DETAILS</th></tr></thead>
          <tbody>{rows.map(transaction => <tr key={transaction.id}>
            <td><div className="history-merchant"><span className={"history-transaction-icon " + (transaction.status === "APPROVED" ? "approved" : "blocked")}>
              {transaction.status === "APPROVED" ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}</span>
              <div><b>{transaction.merchant_name}</b><small>{transaction.decline_reason ?? (transaction.pool_amount > 0 ? "Paid with pool funds" : transaction.fx_ngn_amount > 0 ? "Just-in-time FX" : "Subscription payment")}</small></div></div></td>
            <td><span>{shortDate(transaction.created_at)}</span><small className="history-time">{new Date(transaction.created_at).getUTCFullYear()} · {new Date(transaction.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</small></td>
            <td><b>{money(transaction.amount, transaction.currency, true)}</b><small className="history-time">{transaction.currency}</small></td>
            <td><span className={"badge " + (transaction.status === "APPROVED" ? "green" : "amber")}>{transaction.status === "APPROVED" ? <CheckCircle2 size={11} /> : <ShieldOff size={11} />}{transaction.status === "APPROVED" ? "Approved" : "Blocked"}</span></td>
            <td>{transaction.receipt_url ? <a href={transaction.receipt_url} target="_blank" rel="noreferrer" className="receipt-link"><FileText size={14} /> Receipt <ArrowUpRight size={12} /></a>
              : <details className="decline-details"><summary>Why blocked?</summary><p>{transaction.decline_reason ?? "The payment did not meet your card’s rules."}</p></details>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <div className="history-empty"><Search size={29} /><h3>No payments found.</h3><p>Try another merchant, currency, or date range.</p><button type="button" className="button secondary" onClick={() => { setSearch(""); setStatus("all"); setCurrency("all"); setPeriod("all"); setPage(1); }}>Clear filters</button></div>}
      <div className="history-pagination"><span>{filtered.length ? ((currentPage - 1) * 10 + 1) + "–" + Math.min(currentPage * 10, filtered.length) + " of " + filtered.length + " payments" : "0 payments"} · Latest 100 available</span>
        <div><button type="button" className="icon-button" aria-label="Previous transactions page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} /></button><span>{currentPage} / {pageCount}</span><button type="button" className="icon-button" aria-label="Next transactions page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={15} /></button></div>
      </div>
    </section>
    <div className="bottom-insight"><ShieldOff size={17} /><p>A blocked attempt is recorded for clarity. <b>It doesn’t debit your wallet.</b></p><Link href="/support" className="text-button">Ask us about a payment <ArrowUpRight size={14} /></Link></div>
  </>;
}
