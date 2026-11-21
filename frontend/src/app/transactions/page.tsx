import WorkspacePage from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions — RETREST" };

export default function TransactionsPage() {
  return <WorkspacePage section="transactions" />;
}
