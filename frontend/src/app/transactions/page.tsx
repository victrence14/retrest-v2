import WorkspacePage from "@/features/workspace/WorkspacePage";
import type { WorkspaceSearchParams } from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions — RETREST" };

export default function TransactionsPage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  return <WorkspacePage section="transactions" searchParams={searchParams} />;
}
