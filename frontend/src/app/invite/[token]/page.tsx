import { notFound } from "next/navigation";
import { money, shortDate } from "@retrest/shared";
import { getInvite } from "@/lib/api/server";
import { InvitePage } from "@/features/invites/components/InvitePage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite) notFound();
  return (
    <div className="invite-page">
      <div className="invite-page-brand">
        retrest<span>↗</span>
      </div>
      <InvitePage
        token={token}
        name={invite.name}
        host={invite.host_name.split(" ")[0] ?? invite.host_name}
        merchant={invite.merchant_name}
        amount={money(invite.target_amount, invite.currency)}
        date={shortDate(invite.next_billing_date)}
        demo={invite.demo_enabled}
      />
    </div>
  );
}
