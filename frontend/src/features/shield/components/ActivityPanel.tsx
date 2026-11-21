"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, Check, ShieldOff, TriangleAlert } from "lucide-react";
import { money, relativeTime } from "@retrest/shared";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { decisionDisplay } from "../decisions";

const FEED_LENGTH = 5;
const ICONS = { approved: <Check size={16} />, hike: <TriangleAlert size={15} />, blocked: <ShieldOff size={15} /> };

/** The latest authorization decisions, refreshed by the workspace poll. */
export function ActivityPanel() {
  const { data } = useWorkspace();
  return (
    <section className="panel activity-panel">
      <div className="section-header">
        <h2>
          Live activity{" "}
          <span className="feed-live">
            <span className="status-dot" />
            LIVE
          </span>
        </h2>
        <Link href="/transactions" className="text-button">
          View all <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="activity-feed">
        {data.transactions.slice(0, FEED_LENGTH).map((t) => {
          const { tone, title } = decisionDisplay(t.status);
          const approved = t.status === "APPROVED";
          return (
            <div className="activity-item" key={t.id}>
              <span className={`activity-icon ${tone}`}>{ICONS[tone]}</span>
              <div>
                <div className="activity-title">{title}</div>
                <p>
                  {t.merchant_name} <span>·</span> {money(t.amount, t.currency)}
                </p>
                <span className={`decision-code ${approved ? "approved" : "declined"}`}>{t.status}</span>
                <div className="activity-meta">
                  <small>{relativeTime(t.created_at)}</small>
                  {t.receipt_url && (
                    <a href={t.receipt_url} target="_blank" rel="noreferrer">
                      Receipt <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>
                {t.fx_ngn_amount > 0 && <small className="fx-activity">{money(t.fx_ngn_amount)} auto-converted</small>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="activity-footer">
        <span className="pulse-line">
          <Activity size={15} />
        </span>
        <p>
          Authorization engine online
          <span>Listening for incoming charges</span>
        </p>
      </div>
    </section>
  );
}
