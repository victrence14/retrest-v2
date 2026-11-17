import RetrestApp from "@/components/retrest-app";
import { dashboard, demoEnabled } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function Page() {
  if (!demoEnabled() && !(await currentUser())) return <main style={{ padding: 80 }}><h1>RETREST</h1><p>The buildathon demo is disabled. Connect an identity provider to sign in.</p></main>;
  return <RetrestApp initial={dashboard()} />;
}
