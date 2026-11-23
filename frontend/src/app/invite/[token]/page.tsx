import { notFound } from "next/navigation";
import { money, shortDate } from "@retrest/shared";
import { getInvite } from "@/lib/api/server";
import { InvitePage } from "@/features/invites/components/InvitePage";
import { AccountInvitePage } from "@/features/account/components/AccountInvitePage";
import { requireAccountCookie } from "@/lib/api/account-session";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    await requireAccountCookie(`/invite/${token}`);
    return <AccountInvitePage token={token} />;
  }
  const invite = await getInvite(token);
  if (!invite) notFound();
  return (
    <div className="invite-page">
      <header className="page-appearance-header"><div className="invite-page-brand">
        retrest<span>↗</span>
      </div><ThemeToggle /></header>
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
