"use client";

import { useEffect, useState } from "react";
import { Download, Mail, RefreshCw } from "lucide-react";
import type { CurrencyTotal, EmailJobRecord, MonthlySummaryRecord, PeriodSummary } from "@retrest/shared";
import { EmptyState } from "@/components/ui";
import { errorMessage, isAbort, saveFile } from "@/lib/api/client";
import { accountExport, emailAccountSummary, exactAccountMoney, generateAccountSummary, getAccountEmailJob, getAccountInsights } from "../api";
import { useAccount } from "../AccountContext";
import { beginAccountOperation, finishAccountOperation, readAccountOperation, rememberAccountOperation } from "../operations";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

function CurrencyTotals({ totals }: { totals: CurrencyTotal[] }) {
  return <div className="account-total-grid">{totals.map(total => <div className="account-currency-total" key={total.currency}>
    <span>{total.currency} · Settled payments</span><strong>{exactAccountMoney(total.settled_amount_minor, total.currency)}</strong>
    <p>{total.settled_count} settled · {total.pending_count} pending · {total.declined_count} declined · {total.reversed_count} reversed</p>
    <dl><div><dt>NGN used for FX</dt><dd>{exactAccountMoney(total.fx_ngn_amount_minor, "NGN")}</dd></div>
      <div><dt>Pool funded</dt><dd>{exactAccountMoney(total.pool_amount_minor, total.currency)}</dd></div></dl>
  </div>)}</div>;
}
const jobLabels: Record<EmailJobRecord["status"], string> = {
  QUEUED: "Queued for sending", PROCESSING: "Sending", ACCEPTED: "Accepted by email provider",
  DELIVERED: "Delivered", BOUNCED: "Bounced", FAILED: "Sending failed",
};
const activeJob = (job: EmailJobRecord) => ["QUEUED", "PROCESSING", "ACCEPTED"].includes(job.status);

function SummaryEmail({ summary }: { summary: MonthlySummaryRecord }) {
  const { user, busy, run, onError, notify } = useAccount();
  const [job, setJob] = useState<EmailJobRecord | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const scope = `summary-email:${summary.id}`;
  useEffect(() => {
    let active = true;
    const saved = readAccountOperation(user.id, scope);
    if (saved?.id) getAccountEmailJob(saved.id).then(result => { if (active) setJob(result.job); })
      .catch(failure => { if (active) { setError(errorMessage(failure)); onError(failure); } });
    return () => { active = false; };
  }, [user.id, scope, onError]);
  useEffect(() => {
    if (!job || !activeJob(job)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    async function poll() {
      try {
        const result = await getAccountEmailJob(job!.id);
        if (!active) return;
        setJob(result.job);
        if (result.job.status === "DELIVERED") notify("Your monthly summary email has been delivered.");
        else if (["BOUNCED", "FAILED"].includes(result.job.status)) notify(`Summary email ${result.job.status === "BOUNCED" ? "bounced" : "could not be sent"}.`, true);
        if (activeJob(result.job) && ++checks < 12) timer = setTimeout(poll, 5000);
      } catch (failure) { if (active) { setError(errorMessage(failure)); onError(failure); } }
    }
    timer = setTimeout(poll, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, [job?.id, onError, notify]);
  async function email() {
    setError("");
    const result = await run(async () => {
      const previous = readAccountOperation(user.id, scope);
      if (job && !activeJob(job) && previous) finishAccountOperation(user.id, scope, previous.key);
      const operation = await beginAccountOperation(user.id, scope);
      const result = await emailAccountSummary(summary.id, operation.key);
      rememberAccountOperation(user.id, scope, { ...operation, id: result.job.id });
      return result;
    }, "Summary email requested.");
    if (result) setJob(result.job);
  }
  async function check() {
    if (!job) return;
    setChecking(true); setError("");
    try {
      const result = await getAccountEmailJob(job.id);
      setJob(result.job);
      notify(`Email status: ${jobLabels[result.job.status]}.`, ["BOUNCED", "FAILED"].includes(result.job.status));
    }
    catch (failure) { setError(errorMessage(failure)); onError(failure); }
    finally { setChecking(false); }
  }
  return <div className="account-summary-email"><span aria-live="polite">{job ? jobLabels[job.status] : "Email a copy to your confirmed address."}</span>
    {error && <p className="form-error" role="alert">{error}</p>}
    {job && <button className="text-button" disabled={checking} onClick={() => void check()}><RefreshCw size={13} />Check email status</button>}
    {(!job || !activeJob(job)) && <button className="button secondary" disabled={busy} onClick={() => void email()}><Mail size={14} />{job ? "Send another email" : "Email summary"}</button>}
  </div>;
}

export function AccountInsights() {
  const { busy, run, onError } = useAccount();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [business, setBusiness] = useState("");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const saved = useAccountPage<MonthlySummaryRecord>("summaries", {}, onError);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setSummary(null);
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) { setLoading(false); setError("Choose a month to view totals."); return; }
    getAccountInsights(month, business === "" ? undefined : business === "true", controller.signal)
      .then(result => { if (!controller.signal.aborted) setSummary(result); })
      .catch(failure => { if (!isAbort(failure)) { setError(errorMessage(failure)); onError(failure); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, business, retry, onError]);
  async function download(format: "csv" | "pdf") {
    await run(async () => {
      const blob = await accountExport(month, format);
      saveFile(blob, `retrest-business-receipts-${month}.${format}`);
      return true;
    }, `${format.toUpperCase()} report download started.`);
  }
  async function generate() {
    const result = await run(() => generateAccountSummary(month), "Monthly summary saved.");
    if (result) await saved.refresh();
  }
  const validMonth = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month);
  return <>
    <section className="panel"><div className="section-header"><div><h2>Your monthly totals</h2><p>Complete account totals for the selected month, using UTC dates.</p></div><button className="icon-button" aria-label="Refresh monthly totals" disabled={loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} /></button></div>
      <div className="account-toolbar"><label>Month<input type="month" aria-label="Insights month" value={month} onChange={event => setMonth(event.target.value)} required /></label>
        <label>Expenses<select aria-label="Insights expense filter" value={business} onChange={event => setBusiness(event.target.value)}><option value="">All expenses</option><option value="true">Business</option><option value="false">Personal</option></select></label></div>
      <div className="account-panel-body" aria-live="polite">{loading ? <p>Loading totals…</p> : error ? <p className="form-error" role="alert">{error}</p> : summary?.totals.length ? <CurrencyTotals totals={summary.totals} /> : <EmptyState text="No payments recorded in this month." />}</div>
    </section>
    <section className="panel"><div className="section-header"><div><h2>Business receipts</h2><p>Download every settled business payment for {month || "your selected month"}.</p></div></div>
      <div className="account-panel-body account-actions"><button className="button secondary" disabled={busy || !validMonth} onClick={() => void download("csv")}><Download size={15} />Download CSV</button>
        <button className="button secondary" disabled={busy || !validMonth} onClick={() => void download("pdf")}><Download size={15} />Download PDF</button>
        <span className="account-note">PDF packs support up to 5,000 receipts. Use CSV for larger months.</span></div>
    </section>
    <section className="panel"><div className="section-header"><div><h2>Saved monthly summaries</h2><p>One immutable snapshot per month. Reopening a month returns its saved totals.</p></div><button className="button primary" disabled={busy || !validMonth} onClick={() => void generate()}>Save {month || "month"} summary</button></div>
      <div className="account-panel-body">{saved.rows.map(record => <article className="account-saved-summary" key={record.id}><h3>{record.month}</h3><p className="account-note">Saved {new Date(record.created_at).toLocaleString()}</p><CurrencyTotals totals={record.totals} /><SummaryEmail summary={record} /></article>)}
        {!saved.rows.length && !saved.loading && !saved.error && <EmptyState text="Save a monthly summary to keep a snapshot or request an email." />}
        <AccountListStatus {...saved} count={saved.rows.length} more={saved.cursor ? saved.more : undefined} /></div>
    </section>
  </>;
}
