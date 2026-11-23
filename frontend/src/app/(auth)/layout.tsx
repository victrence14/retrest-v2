import AuthShell from "@/features/auth/components/AuthShell";
import type { ReactNode } from "react";
import { AuthVerificationProvider } from "@/features/auth/AuthVerificationContext";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthVerificationProvider><AuthShell>{children}</AuthShell></AuthVerificationProvider>;
}
