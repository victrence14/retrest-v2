import WorkspacePage from "@/features/workspace/WorkspacePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings — RETREST" };

export default function SettingsPage() {
  return <WorkspacePage section="settings" />;
}
