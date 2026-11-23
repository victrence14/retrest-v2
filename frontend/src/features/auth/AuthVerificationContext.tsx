"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type VerificationIntent = "signup" | "recovery";
interface VerificationRequest { email: string; intent: VerificationIntent; requestedAt: number }
interface VerificationContextValue {
  verification: VerificationRequest | null;
  rememberVerification: (email: string, intent: VerificationIntent) => void;
  clearVerification: () => void;
}
const VerificationContext = createContext<VerificationContextValue | null>(null);

/** Carry the email between auth screens in memory; passwords and codes stay in their form. */
export function AuthVerificationProvider({ children }: { children: ReactNode }) {
  const [verification, setVerification] = useState<VerificationRequest | null>(null);
  return <VerificationContext.Provider value={{ verification,
    rememberVerification: (email, intent) => setVerification({ email, intent, requestedAt: Date.now() }),
    clearVerification: () => setVerification(null) }}>
    {children}
  </VerificationContext.Provider>;
}

export function useAuthVerification() {
  const context = useContext(VerificationContext);
  if (!context) throw new Error("Email verification requires the auth layout.");
  return context;
}
