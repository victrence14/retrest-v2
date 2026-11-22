import AuthScreen from "@/components/auth-screen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";
export const metadata = { title: "Reset password — RETREST" };
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthScreen
      mode="reset-password"
      destination={safeDestination((await searchParams).next)}
    />
  );
}
