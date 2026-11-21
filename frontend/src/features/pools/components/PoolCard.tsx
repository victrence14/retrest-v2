"use client";

import { ArrowUpRight, CheckCheck, Link as LinkIcon, Plus, RefreshCw, Shield, Zap } from "lucide-react";
import { daysUntil, money, shortDate, type Pool } from "@retrest/shared";
import { Avatar, MerchantLogo, Toggle } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { setHostFallback, simulateContribution } from "../api";
import { inviteUrl } from "../invite-link";

function poolBadge(pool: Pool) {
  if (pool.pool_balance >= pool.target_amount) return { tone: "green", label: "Fully funded" };
  return { tone: "amber", label: pool.status === "PAID" ? "Renewal paid" : "Collecting" };
}

export function PoolCard({ pool }: { pool: Pool }) {
  const { data, busy, mutate, copy } = useWorkspace();
  const badge = poolBadge(pool);
  const funded = (pool.pool_balance / pool.target_amount) * 100;
  const host = pool.members.find((m) => m.user_id === pool.host_user_id)?.name ?? data.user.name;

  return (
    <section className="panel pool-card">
      <div className="pool-card-header">
        <MerchantLogo name={pool.merchant_name} />
        <div>
          <h2>{pool.name}</h2>
          <p>
            Hosted by {host} · {pool.members.length} members
          </p>
        </div>
        <span className={`badge ${badge.tone}`}>{badge.label}</span>
      </div>
      <div className="pool-amount">
        <strong>{money(pool.pool_balance, pool.currency)}</strong>
        <span>of {money(pool.target_amount, pool.currency)}</span>
        <small>{Math.min(100, Math.round(funded))}% funded</small>
      </div>
      <div className="pool-progress">
        <span style={{ width: `${Math.min(100, funded)}%` }} />
      </div>
      <div className="pool-renewal">
        <span>
          <RefreshCw size={12} /> Renews {shortDate(pool.next_billing_date)}
        </span>
        <span>{daysUntil(pool.next_billing_date)} days to go</span>
      </div>
      <div className="pool-members">
        {pool.members.map((member, index) => {
          const isMe = member.user_id === data.user.id;
          return (
            <div className="pool-member" key={member.id}>
              <Avatar name={member.name} index={index} />
              <div>
                <b>
                  {member.name}
                  {isMe && <small> (you)</small>}
                </b>
                <span>{money(member.share_amount, pool.currency)} share</span>
              </div>
              {member.payment_status === "PAID" ? (
                <span className="member-paid">
                  <CheckCheck size={14} /> Paid
                </span>
              ) : (
                <button
                  className={`member-status ${member.auto_debit_scheduled ? "scheduled" : ""}`}
                  disabled={busy}
                  title="Simulate this member’s contribution in demo mode"
                  onClick={() =>
                    mutate(
                      () => simulateContribution(pool.id, member.id),
                      `${member.name.split(" ")[0]}’s contribution received (demo).`,
                    )
                  }
                >
                  {member.auto_debit_scheduled ? (
                    <>
                      <Zap size={12} /> Auto-debit scheduled
                    </>
                  ) : (
                    <>
                      <Plus size={12} /> {isMe ? "Pay my share" : "Pending · simulate"}
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="pool-fallback">
        <div>
          <Shield size={15} />
          <span>
            Host wallet fallback
            <small>Cover any shortfall at renewal</small>
          </span>
        </div>
        <Toggle
          on={!!pool.fallback_enabled}
          disabled={busy}
          onClick={() => mutate(() => setHostFallback(pool.id, !pool.fallback_enabled), "Pool fallback updated")}
          label={`Toggle fallback for ${pool.name}`}
        />
      </div>
      <button className="button secondary pool-invite" onClick={() => copy(inviteUrl(pool.invite_token))}>
        <LinkIcon size={15} /> Copy invite link <ArrowUpRight size={14} />
      </button>
    </section>
  );
}
