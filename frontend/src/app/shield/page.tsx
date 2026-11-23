import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";

export default function ShieldPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="shield" searchParams={searchParams} />;
}
