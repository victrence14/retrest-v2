import type { WorkspaceSection } from "@/lib/navigation";
import { getInitialDashboard } from "@/lib/api/server";
import WorkspaceApp from "./WorkspaceApp";

/** Server entry for every workspace route: loads the first snapshot from the backend. */
export default async function WorkspacePage({ section }: { section: WorkspaceSection }) {
  const initial = await getInitialDashboard();
  if (!initial) {
    return (
      <main className="unavailable-page">
        <h1>RETREST</h1>
        <p>The demo is disabled. Account authentication connects in the next phase.</p>
      </main>
    );
  }
  return <WorkspaceApp initial={initial} section={section} />;
}
