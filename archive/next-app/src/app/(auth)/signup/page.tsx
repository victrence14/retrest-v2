import AuthScreen from "@/components/auth-screen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";
export const metadata = { title: "Create an account — RETREST" };
export default async function SignupPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthScreen mode="signup" destination={safeDestination((await searchParams).next)} />;
}
