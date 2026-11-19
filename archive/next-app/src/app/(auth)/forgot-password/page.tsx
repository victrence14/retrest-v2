import AuthScreen from "@/components/auth-screen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";
export const metadata = { title: "Forgot password — RETREST" };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthScreen mode="forgot-password" destination={safeDestination((await searchParams).next)} />;
}
