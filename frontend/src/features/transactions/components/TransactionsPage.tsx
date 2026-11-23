"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, Search, ShieldOff, Wallet } from "lucide-react";
import { money } from "@retrest/shared";
import type { Transaction, User } from "@retrest/shared";
import TransactionDetail from "./TransactionDetail";
import "../styles.css";

export interface TransactionsPageProps { user: User; transactions: Transaction[] }

export function TransactionsPage({ user, transactions }: TransactionsPageProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const approved = transactions.filter(transaction => transaction.status === "APPROVED");
  const blocked = transactions.filter(transaction => transaction.status.startsWith("DECLINED"));
  const filtered = transactions.filter(transaction => {
    const matchesStatus = status === "all" || (status === "approved" ? transaction.status === "APPROVED" : status === "blocked" ? transaction.status.startsWith("DECLINED") : transaction.status !== "APPROVED" && !transaction.status.startsWith("DECLINED"));
    return matchesStatus && (currency === "all" || transaction.currency === currency) && (!month || transaction.created_at.slice(0, 7) === month) && `${transaction.merchant_name} ${transaction.decline_reason ?? ""}`.toLowerCase().includes(search.toLowerCase().trim());
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const selectedTransaction = transactions.find(transaction => transaction.id === selected);

  return <div className="fe2-transactions">
    <div className="history-summary">
      <section className="panel history-stat"><span><Wallet size={16} />NGN wallet</span><strong>{money(user.ngn_balance)}</strong><small>Confirmed demo balance</small></section>
      <section className="panel history-stat"><span><CreditCard size={16} />USD wallet</span><strong>{money(user.usd_balance, "USD", true)}</strong><small>Confirmed demo balance</small></section>
      <section className="panel history-stat"><span><CheckCircle2 size={16} />Approved in this snapshot</span><strong>{approved.length}<i>payments</i></strong><small>Server-approved demo payments</small></section>
      <section className="panel history-stat"><span><ShieldOff size={16} />Blocked in this snapshot</span><strong>{blocked.length}<i>attempts</i></strong><small>Declines preserve wallet funds</small></section>
    </div>
    <section className="panel history-panel">
      <div className="section-header"><div><h2>Recent payment history <span className="count-badge">{transactions.length}</span></h2><p>Latest 100 records. Filters and pages apply to this snapshot.</p></div><Link href="/insights?demo=1" className="text-button">Business receipt packs<ArrowUpRight size={14} /></Link></div>
      <p className="fe2-history-scope">Older history needs the full history service. Monthly business exports include all matching approved expenses.</p>
      <div className="history-toolbar">
        <div className="segmented" aria-label="Filter transactions by status">{[["all", "All activity"], ["approved", "Approved"], ["blocked", "Blocked"], ["unsettled", "Unsettled"]].map(([value, label]) => <button key={value} type="button" className={status === value ? "selected" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
        <div className="history-filters"><label className="history-search"><Search size={15} /><input aria-label="Search transactions" placeholder="Find a payment" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label="Transaction currency" value={currency} onChange={event => { setCurrency(event.target.value); setPage(1); }}><option value="all">All currencies</option><option value="NGN">NGN</option><option value="USD">USD</option></select><label className="fe2-history-month">Month<input aria-label="Transaction month" type="month" value={month} onChange={event => { setMonth(event.target.value); setPage(1); }} /></label></div>
      </div>
      <div className="table-scroll"><table className="history-table"><thead><tr><th>PAYMENT</th><th>DATE</th><th>AMOUNT</th><th>DECISION</th><th>DETAILS</th></tr></thead><tbody>{rows.map(transaction => <tr key={transaction.id}>
        <td><div className="history-merchant"><span className={`history-transaction-icon ${transaction.status === "APPROVED" ? "approved" : "blocked"}`}>{transaction.status === "APPROVED" ? <CheckCircle2 size={18} /> : <ShieldOff size={18} />}</span><div><b>{transaction.merchant_name}</b><small>{transaction.decline_reason ?? (transaction.pool_amount > 0 ? "Pool funding" : transaction.fx_ngn_amount > 0 ? "Just-in-time FX" : "Subscription payment")}</small></div></div></td>
        <td><time dateTime={transaction.created_at}>{new Date(transaction.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time><small className="history-time">{new Date(transaction.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</small></td>
        <td><b>{money(transaction.amount, transaction.currency, true)}</b><small className="history-time">{transaction.currency}</small></td>
        <td><span className={`badge ${transaction.status === "APPROVED" ? "green" : "amber"}`}>{transaction.status === "APPROVED" ? "Approved · demo" : transaction.status.startsWith("DECLINED") ? "Declined" : transaction.status}</span></td>
        <td><button type="button" className="text-button" aria-label={`View details for ${transaction.merchant_name} ${transaction.id}`} onClick={() => setSelected(transaction.id)}>View details<ArrowUpRight size={12} /></button></td>
      </tr>)}</tbody></table></div>
      {!rows.length && <div className="history-empty"><Search size={29} /><h3>No payments found.</h3><p>Try another merchant, currency, or month.</p><button type="button" className="button secondary" onClick={() => { setSearch(""); setStatus("all"); setCurrency("all"); setMonth(""); setPage(1); }}>Clear filters</button></div>}
      <div className="history-pagination"><span>{filtered.length ? `${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, filtered.length)} of ${filtered.length} records` : "0 records"} · Recent snapshot</span><div><button type="button" className="icon-button" aria-label="Previous transactions page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} /></button><span>{currentPage} / {pageCount}</span><button type="button" className="icon-button" aria-label="Next transactions page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={15} /></button></div></div>
    </section>
    <div className="bottom-insight"><ShieldOff size={17} /><p>A declined attempt is recorded with its reason. <b>It does not debit your wallet.</b></p><Link href="/support?demo=1" className="text-button">Payment help<ArrowUpRight size={14} /></Link></div>
    {selectedTransaction && <TransactionDetail key={selectedTransaction.id} transaction={selectedTransaction} onClose={() => setSelected(null)} />}
  </div>;
}

export default TransactionsPage;
