import AuthScreen from "@/components/auth-screen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";
export const metadata = { title: "Log in — RETREST" };
export default async function LoginPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthScreen mode="login" destination={safeDestination((await searchParams).next)} />;
}
