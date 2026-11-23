"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { money, type TransactionRecord } from "@retrest/shared";
import { DialogFrame, EmptyState, MerchantLogo } from "@/components/ui";
import { saveFile } from "@/lib/api/client";
import { accountReceipt, getAccountTransaction } from "../api";
import { useAccount } from "../AccountContext";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

export function AccountTransactions() {
  const { busy, run, onError } = useAccount();
  const [month, setMonth] = useState("");
  const [currency, setCurrency] = useState("");
  const [status, setStatus] = useState("");
  const [business, setBusiness] = useState("");
  const [selected, setSelected] = useState<TransactionRecord | null>(null);
  const list = useAccountPage<TransactionRecord>("transactions", { month: month || undefined, currency: currency || undefined, status: status || undefined, business: business || undefined }, onError);
  async function receipt(record: TransactionRecord) {
    await run(async () => {
      const blob = await accountReceipt(record);
      saveFile(blob, `retrest-receipt-${record.id}.pdf`);
      return true;
    }, "Receipt PDF download started.");
  }
  async function details(record: TransactionRecord) { const result = await run(() => getAccountTransaction(record.id)); if (result) setSelected(result.transaction); }
  return <><section className="panel"><div className="section-header"><div><h2>Payment history</h2><p>Receipts are available for confirmed settled payments.</p></div><button className="button secondary" disabled={list.loading} onClick={() => void list.refresh()}><RefreshCw size={15} />Refresh</button></div>
    <div className="account-toolbar"><label>Month<input type="month" aria-label="Transaction month" value={month} onChange={event => setMonth(event.target.value)} /></label>
      <label>Currency<select aria-label="Transaction currency" value={currency} onChange={event => setCurrency(event.target.value)}><option value="">All currencies</option><option>NGN</option><option>USD</option></select></label>
      <label>Status<select aria-label="Transaction status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{["PENDING", "SETTLED", "DECLINED", "REVERSED"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Expenses<select aria-label="Transaction expense filter" value={business} onChange={event => setBusiness(event.target.value)}><option value="">All expenses</option><option value="true">Business</option><option value="false">Personal</option></select></label></div>
    <div className="table-scroll"><table className="account-table"><thead><tr><th>MERCHANT</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>RECEIPT</th></tr></thead><tbody>
      {list.rows.map(record => <tr key={record.id}><td><button className="merchant-cell" onClick={() => void details(record)}><MerchantLogo name={record.merchant_name} /><span><b>{record.merchant_name}</b><small>{record.is_business_expense ? "Business" : "Personal"}</small></span></button></td>
        <td>{new Date(record.created_at).toLocaleDateString()}</td><td>{money(record.amount_minor, record.currency)}</td><td><span className={"badge " + (record.status === "SETTLED" ? "approved" : record.status === "DECLINED" ? "declined" : "neutral")}>{record.status}</span></td>
        <td><button className="text-button" aria-label={`Download receipt for ${record.merchant_name}`} disabled={busy || record.status !== "SETTLED"} onClick={() => void receipt(record)}><Download size={15} />PDF</button></td></tr>)}
    </tbody></table></div>
    {!list.rows.length && !list.loading && !list.error && <EmptyState text="No payments match these filters." />}
    <AccountListStatus {...list} count={list.rows.length} more={list.cursor ? list.more : undefined} />
  </section>{selected && <DialogFrame label="Transaction details" busy={busy} onClose={() => setSelected(null)}><div className="account-dialog-heading"><span className="eyebrow">PAYMENT DETAILS</span><h2>{selected.merchant_name}</h2><p>{money(selected.amount_minor, selected.currency)} · {selected.status}</p></div>
    <dl className="account-details"><dt>Recorded</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd><dt>Settled</dt><dd>{selected.settled_at ? new Date(selected.settled_at).toLocaleString() : "Not settled"}</dd>
      <dt>Pool funding</dt><dd>{money(selected.pool_amount, selected.currency)}</dd><dt>NGN conversion</dt><dd>{money(selected.fx_ngn_amount, "NGN")}</dd>{selected.decline_reason && <><dt>Decision reason</dt><dd>{selected.decline_reason}</dd></>}</dl>
    <button className="button primary full-width" disabled={busy || selected.status !== "SETTLED"} onClick={() => void receipt(selected)}><Download size={16} />Download receipt</button>
  </DialogFrame>}</>;
}
