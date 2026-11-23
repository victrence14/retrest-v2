import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pools & Split — RETREST" };

export default function PoolsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="pools" searchParams={searchParams} />;
}
