import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings — RETREST" };

export default function SettingsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="settings" searchParams={searchParams} />;
}
