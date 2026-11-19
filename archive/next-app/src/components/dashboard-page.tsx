import RetrestApp from "@/components/retrest-app";
import { dashboard, demoEnabled } from "@/lib/db";
import { currentUser } from "@/lib/session";
import type { WorkspaceSection } from "@/lib/navigation";

export default async function DashboardPage({ section }: { section: WorkspaceSection }) {
  const userId = await currentUser();
  if (!demoEnabled() && !userId) {
    return <main className="unavailable-page"><h1>RETREST</h1><p>The demo is disabled. Account authentication connects in the next phase.</p></main>;
  }
  return <RetrestApp initial={dashboard(userId ?? undefined)} section={section} />;
}
