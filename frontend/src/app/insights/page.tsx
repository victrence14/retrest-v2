import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights & Vault — RETREST" };

export default function InsightsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="insights" searchParams={searchParams} />;
}
