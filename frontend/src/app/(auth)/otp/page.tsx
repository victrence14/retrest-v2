import AuthScreen from "@/features/auth/components/AuthScreen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";

export default async function OtpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const query = await searchParams;
  return <AuthScreen mode="otp" destination={safeDestination(query.next)}
    verificationIntent={query.intent === "recovery" ? "recovery" : "signup"} />;
}
