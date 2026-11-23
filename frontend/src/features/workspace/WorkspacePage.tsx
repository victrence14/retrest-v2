import Link from "next/link";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { getInitialDashboard } from "@/lib/api/server";
import { requireAccountCookie } from "@/lib/api/account-session";
import AccountWorkspace from "@/features/account/components/AccountWorkspace";
import WorkspaceApp from "./WorkspaceApp";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export type WorkspaceSearchParams = Promise<{ demo?: string | string[]; simulator?: string | string[] }>;

export default async function WorkspacePage({ section, searchParams }: { section: WorkspaceSection; searchParams: WorkspaceSearchParams }) {
  if ((await searchParams).demo !== "1") {
    await requireAccountCookie(workspacePages[section].href);
    return <AccountWorkspace section={section} />;
  }
  const initial = await getInitialDashboard();
  if (!initial) {
    return (
      <main className="unavailable-page">
        <h1>RETREST</h1>
        <ThemeToggle />
        <p>The demo is disabled. Log in to open your account.</p>
        <Link href="/login" className="button primary">Log in</Link>
      </main>
    );
  }
  return <WorkspaceApp initial={initial} section={section} />;
}
