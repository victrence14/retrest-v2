"use client";

import { ArrowUpRight, CheckCircle2, FileText, RefreshCw, ShieldOff } from "lucide-react";
import { money, shortDate, type DemoResult } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

/** The engine's decision for the last simulated charge. */
export function DemoResultCard({ result }: { result: Omit<DemoResult, "state"> }) {
  const { data } = useWorkspace();
  const approved = result.decision === "APPROVE";
  const status = data.transactions.find((t) => t.id === result.transaction_id)?.status ?? result.decision;
  const renewal = data.subscriptions.find((s) => s.merchant_name === result.merchant_name)?.next_billing_date;
  return (
    <div className={`demo-result ${approved ? "approved" : "declined"}`} role="status">
      <div>
        <span>{approved ? <CheckCircle2 size={24} /> : <ShieldOff size={24} />}</span>
        <b>{approved ? "Payment approved." : "Your money stayed put."}</b>
      </div>
      <p>{result.reason}</p>
      <dl>
        <dt>Merchant</dt>
        <dd>{result.merchant_name}</dd>
        <dt>Attempted amount</dt>
        <dd>{money(result.amount, result.currency)}</dd>
        <dt>Authorization status</dt>
        <dd>
          <span className={`decision-code ${approved ? "approved" : "declined"}`}>{status}</span>
        </dd>
        <dt>Decision time</dt>
        <dd>
          {result.duration_ms} ms <span className="lime-text">· HTTP {result.http_status}</span>
        </dd>
        {result.fx_ngn_amount > 0 && (
          <>
            <dt>NGN auto-converted</dt>
            <dd>{money(result.fx_ngn_amount)}</dd>
          </>
        )}
        {result.pool_amount > 0 && (
          <>
            <dt>Paid from pool</dt>
            <dd>{money(result.pool_amount, result.currency)}</dd>
          </>
        )}
      </dl>
      {approved && (
        <div className="renewal-confirmation">
          <RefreshCw size={14} />
          <span>Renewal advanced by 30 days · {shortDate(renewal ?? new Date().toISOString())}</span>
        </div>
      )}
      {result.receipt_url && (
        <a className="button primary" href={result.receipt_url} target="_blank" rel="noreferrer">
          <FileText size={15} /> Your receipt is ready <ArrowUpRight size={14} />
        </a>
      )}
    </div>
  );
}
