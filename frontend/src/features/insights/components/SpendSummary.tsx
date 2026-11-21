"use client";

import { useRef, useState } from "react";
import { Copy, Download, FileText, Mail } from "lucide-react";
import type { Dashboard } from "@retrest/shared";
import { money } from "@retrest/shared";
import { errorMessage } from "@/lib/api/client";
import { downloadBusinessExport, loadBusinessExpenses } from "../api";
import { businessTotals, type BusinessExpense } from "../business-export";
import "../styles.css";

export interface SpendSummaryProps { data: Dashboard; email?: string; notify?: (text: string, error?: boolean) => void }

export function SpendSummary({ data, notify }: SpendSummaryProps) {
  const [month, setMonth] = useState(data.transactions[0]?.created_at.slice(0, 7) ?? new Date().toISOString().slice(0, 7));
  const [confirmedMonth, setConfirmedMonth] = useState<string | null>(null);
  const [rows, setRows] = useState<BusinessExpense[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const totals = rows ? businessTotals(rows) : null;
  async function action(run: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await run(); } catch (error) { setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section className="fe2-insights spend-summary-content">
    <span className="modal-kicker"><FileText size={14} />MONTHLY BUSINESS REPORT</span><h2>Your business month.<br />A clearer picture<span>.</span></h2>
    <p className="modal-description">Load every approved business expense for the month. NGN and USD totals stay separate.</p>
    <form className="fe2-summary-form" onSubmit={event => { event.preventDefault(); action(async () => { const result = await loadBusinessExpenses(month); setRows(result); setConfirmedMonth(month); }); }}><label>Month & year<input type="month" aria-label="Summary month" required value={month} disabled={busy} onChange={event => { setMonth(event.target.value); setRows(null); setConfirmedMonth(null); setError(""); }} /></label><button className="button primary" disabled={busy} type="submit"><FileText size={15} />{busy ? "Loading…" : "Load monthly report"}</button></form>
    {totals && confirmedMonth && <div className="generated-summary"><h3>{new Date(`${confirmedMonth}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</h3><div className="fe2-business-totals summary-totals"><div><span>BUSINESS SPEND · NGN</span><strong>{money(totals.NGN, "NGN", true)}</strong></div><div><span>BUSINESS SPEND · USD</span><strong>{money(totals.USD, "USD", true)}</strong></div></div><p role="status" className="fe2-insights-note">{rows?.length} approved demo receipts from the complete server export.</p><div className="fe2-summary-downloads"><button type="button" className="button primary" disabled={busy} onClick={() => action(() => downloadBusinessExport(confirmedMonth, "pdf"))}><Download size={15} />Download business report PDF</button><button type="button" className="button secondary" disabled={busy} onClick={() => action(() => downloadBusinessExport(confirmedMonth, "csv"))}>Download CSV</button><button type="button" className="text-button" onClick={() => action(async () => { await navigator.clipboard.writeText(`RETREST monthly business report · ${confirmedMonth}\n${rows?.length} approved demo receipts\nNGN: ${money(totals.NGN, "NGN", true)}\nUSD: ${money(totals.USD, "USD", true)}\nComplete approved business expenses. Personal spending is excluded. Payments are simulated.`); notify?.("Business report copied."); })}><Copy size={14} />Copy report totals</button></div></div>}
    {error && <p role="alert" className="fe2-insights-error">{error}</p>}
    <div className="fe2-summary-delivery"><Mail size={20} /><div><h3>Email delivery is not connected.</h3><p>No server delivery status is available. Your report can be downloaded above.</p><small>Account email: {data.user.email}</small></div><button type="button" className="button secondary" disabled>Send monthly summary</button></div>
    <p className="fe2-insights-note">Full personal spending, generated recommendations, and emailed monthly summaries are awaiting their server services.</p>
  </section>;
}

export default SpendSummary;
