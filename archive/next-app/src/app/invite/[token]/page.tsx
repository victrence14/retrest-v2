import { getDb, demoEnabled } from "@/lib/db";
import { notFound } from "next/navigation";
import { money, shortDate } from "@/lib/format";
import InviteCard from "@/components/invite-card";
import type { Currency } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const pool = db
    .prepare(
      "SELECT p.name,p.target_amount,p.currency,p.pool_balance,s.merchant_name,s.next_billing_date,u.name host_name FROM split_pools p JOIN merchant_subscriptions s ON s.id=p.subscription_id JOIN users u ON u.id=p.host_user_id WHERE p.invite_token=?",
    )
    .get(token);
  if (!pool) notFound();
  return (
    <div className="invite-page">
      <div className="invite-page-brand">
        retrest<span>↗</span>
      </div>
      <InviteCard
        token={token}
        name={String(pool.name)}
        host={String(pool.host_name).split(" ")[0]}
        merchant={String(pool.merchant_name)}
        amount={money(Number(pool.target_amount), pool.currency as Currency)}
        date={shortDate(String(pool.next_billing_date))}
        demo={demoEnabled()}
      />
    </div>
  );
}
