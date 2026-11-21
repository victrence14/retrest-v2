"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Download, RefreshCw } from "lucide-react";
import { money } from "../../lib/format";
import { errorMessage, isAbort, saveFile } from "../shared/api";
import { loadReceipt } from "../transactions/api";
import { downloadBusinessExport, loadBusinessExpenses } from "./api";
import { businessTotals, validMonth, type BusinessExpense } from "./business-export";
import "./styles.css";

export interface ExpenseVaultProps { initialMonth?: string }

export function ExpenseVault({ initialMonth }: ExpenseVaultProps) {
  const [month, setMonth] = useState(initialMonth ?? new Date().toISOString().slice(0, 7));
  const [currency, setCurrency] = useState("all");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [rows, setRows] = useState<BusinessExpense[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setRows(null); setError(""); setPage(1);
    if (!validMonth(month)) { setError("Choose a valid receipt month."); return; }
    loadBusinessExpenses(month, controller.signal).then(result => { if (!controller.signal.aborted) setRows(result); }).catch(error => { if (!isAbort(error) && !controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [month, refresh]);
  const totals = rows ? businessTotals(rows) : null;
  const filtered = rows?.filter(row => currency === "all" || row.currency === currency) ?? [];
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);

  async function download(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setDownloading(true); setActionError("");
    try { await action(); } catch (error) { setActionError(errorMessage(error)); }
    finally { setDownloading(false); lock.current = false; }
  }

  return <section className="fe2-insights panel fe2-vault" aria-label="Business expense vault">
    <div className="fe2-insights-heading"><div><span className="eyebrow">BUSINESS EXPENSE VAULT</span><h2><BriefcaseBusiness size={19} />Every work receipt, in one place.</h2><p>Complete monthly results from the server, in the original charge currency.</p></div></div>
    <div className="fe2-vault-controls"><label>Receipt month<input aria-label="Receipt month" type="month" value={month} onChange={event => { setMonth(event.target.value); setActionError(""); }} required /></label><label>Currency<select aria-label="Business expense currency" value={currency} onChange={event => { setCurrency(event.target.value); setPage(1); }}><option value="all">All expenses</option><option value="NGN">NGN</option><option value="USD">USD</option></select></label><label>Export format<select aria-label="Export receipt format" value={format} onChange={event => setFormat(event.target.value as "csv" | "pdf")}><option value="csv">CSV</option><option value="pdf">PDF</option></select></label><button type="button" className="button primary" disabled={downloading || !validMonth(month)} onClick={() => download(() => downloadBusinessExport(month, format))}><Download size={15} />{downloading ? "Downloading…" : "Export receipt pack"}</button><button type="button" className="icon-button" aria-label="Refresh business expenses" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /></button></div>
    {totals && <div className="fe2-business-totals"><div><span>MONTHLY BUSINESS · NGN</span><strong>{money(totals.NGN, "NGN", true)}</strong></div><div><span>MONTHLY BUSINESS · USD</span><strong>{money(totals.USD, "USD", true)}</strong></div><div><span>APPROVED DEMO RECEIPTS</span><strong>{rows?.length}</strong></div></div>}
    {error ? <div className="fe2-insights-error" role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={() => setRefresh(value => value + 1)}>Retry loading expenses</button></div> : rows == null ? <p role="status" className="fe2-insights-note">Loading complete monthly expenses…</p> : <>
      <div className="table-scroll"><table className="fe2-vault-table"><thead><tr><th>MERCHANT</th><th>DATE</th><th>AMOUNT</th><th>RECEIPT</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(row => <tr key={row.receiptId}><td>{row.merchant}</td><td>{new Date(row.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td><td>{money(row.amountMinor, row.currency, true)} <small>{row.currency}</small></td><td>{row.receiptUrl ? <button type="button" className="text-button" disabled={downloading} aria-label={`Download receipt for ${row.merchant} ${row.receiptId}`} onClick={() => download(async () => saveFile(await loadReceipt({ id: row.receiptId, status: row.status, receipt_url: row.receiptUrl }), `retrest-receipt-${row.receiptId}.pdf`))}>Download PDF</button> : "Unavailable"}</td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="fe2-insights-note">No approved business expenses for this month and currency.</p>}
      <div className="fe2-vault-footer"><span>{filtered.length} matching receipts · {rows.length} in the complete month</span><div><button type="button" className="icon-button" aria-label="Previous business expenses page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} /></button><span>{currentPage} / {pageCount}</span><button type="button" className="icon-button" aria-label="Next business expenses page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={15} /></button></div></div>
    </>}
    {actionError && <p className="fe2-insights-error" role="alert">{actionError}</p>}
    <p className="fe2-insights-note">Exports include every approved business expense in the selected month, across both currencies. Currency filtering affects this table. Personal expenses and declined attempts are excluded.</p>
  </section>;
}

export default ExpenseVault;
