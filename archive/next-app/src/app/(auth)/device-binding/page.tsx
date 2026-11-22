import AuthScreen from "@/components/auth-screen";
import { safeDestination, type AuthSearchParams } from "@/lib/navigation";
export const metadata = { title: "Trust this device — RETREST" };
export default async function DeviceBindingPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return (
    <AuthScreen
      mode="device-binding"
      destination={safeDestination((await searchParams).next)}
    />
  );
}
