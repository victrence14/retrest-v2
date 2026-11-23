import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat with us — RETREST" };

export default function SupportPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="support" searchParams={searchParams} />;
}
