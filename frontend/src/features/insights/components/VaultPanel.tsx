"use client";

import { useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Download, FileText, LockKeyhole } from "lucide-react";
import { money, shortDate } from "@retrest/shared";
import { EmptyState, MerchantLogo } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

type CurrencyFilter = "all" | "NGN" | "USD";
const CURRENCY_FILTERS: CurrencyFilter[] = ["all", "NGN", "USD"];

/** Approved business expenses for a month, with a downloadable receipt pack. */
export function VaultPanel() {
  const { data } = useWorkspace();
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const receipts = data.transactions.filter(
    (t) =>
      t.is_business_expense &&
      t.status === "APPROVED" &&
      t.created_at.slice(0, 7) === month &&
      (currencyFilter === "all" || t.currency === currencyFilter),
  );

  return (
    <section className="panel vault-panel">
      <div className="section-header">
        <div>
          <h2>
            <BriefcaseBusiness size={19} /> Business expense vault
          </h2>
          <p>Every work expense. Every receipt. Already in one place.</p>
        </div>
        <div className="export-controls">
          <select aria-label="Export receipt format" value={format} onChange={(e) => setFormat(e.target.value as "csv" | "pdf")}>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <a className="button primary" href={`/api/export?format=${format}&month=${month}`}>
            <Download size={15} /> Export receipt pack
          </a>
        </div>
      </div>
      <div className="vault-toolbar">
        <div className="segmented">
          {CURRENCY_FILTERS.map((f) => (
            <button key={f} className={currencyFilter === f ? "selected" : ""} onClick={() => setCurrencyFilter(f)}>
              {f === "all" ? "All expenses" : f}
            </button>
          ))}
        </div>
        <label>
          <input type="month" aria-label="Receipt month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      <div className="table-scroll">
        <table className="vault-table">
          <thead>
            <tr>
              <th>MERCHANT</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>CATEGORY</th>
              <th>RECEIPT</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="merchant-cell">
                    <MerchantLogo name={t.merchant_name} small />
                    <b>{t.merchant_name}</b>
                  </div>
                </td>
                <td>{shortDate(t.created_at)}</td>
                <td>
                  <b>{money(t.amount, t.currency)}</b>
                </td>
                <td>
                  <span className="badge neutral">
                    <BriefcaseBusiness size={11} /> Business expense
                  </span>
                </td>
                <td>
                  <a href={t.receipt_url ?? "#"} target="_blank" rel="noreferrer" className="receipt-link">
                    <FileText size={14} /> View <ArrowUpRight size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!receipts.length && <EmptyState text="No settled business expenses for this month and currency." />}
      </div>
      <div className="table-footer">
        <LockKeyhole size={13} />
        {receipts.length} verified receipts · Ready for your accountant
      </div>
    </section>
  );
}
