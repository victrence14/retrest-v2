"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import type { Transaction } from "@retrest/shared";
import { money } from "@retrest/shared";
import { errorMessage, isAbort, saveFile } from "@/lib/api/client";
import { loadReceipt, receiptEligible } from "../api";
import "../styles.css";

export interface TransactionDetailProps { transaction: Transaction; onClose: () => void }

export function TransactionDetail({ transaction, onClose }: TransactionDetailProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLIFrameElement>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const approved = transaction.status === "APPROVED";
  const eligible = receiptEligible(transaction);
  const declined = transaction.status.startsWith("DECLINED");

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => { request.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);
  useEffect(() => { if (pdfUrl) preview.current?.scrollIntoView({ block: "nearest" }); }, [pdfUrl]);

  async function documentAction(download: boolean) {
    if (lock.current || !eligible) return;
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      const blob = await loadReceipt(transaction, controller.signal);
      if (download) saveFile(blob, `retrest-receipt-${transaction.id}.pdf`);
      else { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); const url = URL.createObjectURL(blob); objectUrl.current = url; setPdfUrl(url); }
    } catch (error) { if (!isAbort(error)) setError(errorMessage(error)); }
    finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  }

  return <dialog className="fe2-transactions fe2-transaction-dialog" ref={dialog} aria-label={`Transaction details for ${transaction.merchant_name}`} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="fe2-transaction-detail">
      <button type="button" className="icon-button fe2-transaction-close" aria-label="Close transaction details" onClick={() => dialog.current?.close()}><X size={20} /></button>
      <span className="eyebrow">PAYMENT DECISION</span><h2>{transaction.merchant_name}</h2><strong className="fe2-transaction-amount">{money(transaction.amount, transaction.currency, true)}</strong>
      <span className="fe2-transaction-status">{approved ? "Approved · demo" : declined ? "Declined" : transaction.status}</span>
      <p className="fe2-transaction-reason">{transaction.decline_reason ?? (approved ? "Approved by the demo authorization engine." : "The server has not confirmed an approved payment.")}</p>
      <dl className="fe2-transaction-facts">
        <div><dt>Date</dt><dd><time dateTime={transaction.created_at}>{new Date(transaction.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time></dd></div>
        <div><dt>Transaction ID</dt><dd>{transaction.id}</dd></div>
        <div><dt>Authorization ID</dt><dd>{transaction.authorization_id}</dd></div>
        {approved && <><div><dt>Pool funds used</dt><dd>{money(transaction.pool_amount, transaction.currency, true)}</dd></div><div><dt>Wallet-funded remainder</dt><dd>{money(transaction.amount - transaction.pool_amount, transaction.currency, true)}</dd></div><div><dt>NGN converted for this payment</dt><dd>{money(transaction.fx_ngn_amount, "NGN", true)}</dd></div></>}
      </dl>
      <p className="fe2-transaction-note">{approved ? "FX conversion is shown separately in NGN. It is included in the wallet-funded amount, not added to the charge. Payment issuance, funding and settlement are simulated." : declined ? "This declined attempt did not debit your wallet and has no settled receipt." : "A receipt is unavailable until the server confirms an eligible payment."}</p>
      {eligible && <div className="fe2-transaction-document-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => documentAction(false)}><FileText size={15} />{busy ? "Loading…" : "View receipt"}</button><button type="button" className="button primary" disabled={busy} onClick={() => documentAction(true)}><Download size={15} />Download receipt PDF</button></div>}
      {error && <p role="alert" className="fe2-transaction-error">{error}</p>}
      {pdfUrl && eligible && <><a href={pdfUrl} target="_blank" rel="noreferrer" className="text-button fe2-transaction-open-pdf">Open receipt PDF in a new tab</a><iframe ref={preview} title="Authenticated receipt PDF" src={pdfUrl} className="fe2-transaction-pdf" /></>}
    </div>
  </dialog>;
}

export default TransactionDetail;
