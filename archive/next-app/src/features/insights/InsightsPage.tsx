"use client";

import { useState } from "react";
import { ArrowUpRight, Globe, ShieldCheck } from "lucide-react";
import type { Dashboard } from "../../lib/types";
import { money } from "../../lib/format";
import ExpenseVault from "./ExpenseVault";
import SpendSummary from "./SpendSummary";
import "./styles.css";

export interface InsightsPageProps { data: Dashboard; onReviewSubscription: (id: string) => void }

export function InsightsPage({ data, onReviewSubscription }: InsightsPageProps) {
  const [report, setReport] = useState(false);
  const flagged = data.subscriptions.filter(subscription => !!subscription.needs_review);
  return <div className="fe2-insights">
    <div className="fe2-insight-overview"><section className="panel fe2-insight-card"><Globe size={23} /><span className="eyebrow">SERVER DEMO FX QUOTE</span><h2>1 USD = {money(Math.round(data.exchange_rate * 100), "NGN", true)}</h2><p>This is the current simulated quote. Reports keep currencies separate and do not apply it to historical spending.</p></section><section className="panel fe2-insight-card"><ShieldCheck size={23} /><span className="eyebrow">SUBSCRIPTIONS FLAGGED BY THE SERVER</span><h2>{flagged.length} plans to review</h2><p>Open a flagged subscription to review its price and rules.</p>{flagged.map(subscription => <button key={subscription.id} type="button" className="text-button" onClick={() => onReviewSubscription(subscription.id)}>Review {subscription.merchant_name}<ArrowUpRight size={14} /></button>)}{!flagged.length && <p>No subscriptions are currently flagged.</p>}</section></div>
    <ExpenseVault />
    <div className="panel fe2-insight-card"><h2>Your monthly business report.</h2><p>Complete business expenses, downloadable as CSV or PDF. Full personal spending and email summaries are not connected yet.</p><button type="button" className="button secondary" onClick={() => setReport(value => !value)}>{report ? "Close monthly report" : "Open monthly business report"}</button>{report && <SpendSummary data={data} />}</div>
  </div>;
}

export default InsightsPage;
