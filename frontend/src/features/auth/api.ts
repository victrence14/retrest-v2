import type { AccountUser } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

export type AuthResult = { user?: AccountUser; confirmation_required?: boolean; ok?: boolean };
export const login = (email: string, password: string) =>
  requestJson<AuthResult>("/api/auth/login", { method: "POST", body: { email, password } });
export const signup = (email: string, password: string, display_name: string) =>
  requestJson<AuthResult>("/api/auth/signup", { method: "POST", body: { email, password, display_name } });
export const forgotPassword = (email: string) =>
  requestJson<AuthResult>("/api/auth/forgot-password", { method: "POST", body: { email } });
export const resetPassword = (password: string) =>
  requestJson<AuthResult>("/api/auth/password", { method: "PATCH", body: { password } });
export const changeEmail = (email: string) =>
  requestJson<AuthResult>("/api/auth/email", { method: "PATCH", body: { email } });
export const logout = () => requestJson<AuthResult>("/api/auth/logout", { method: "POST" });
export const resendConfirmation = (email: string) =>
  requestJson<AuthResult>("/api/auth/resend-confirmation", { method: "POST", body: { email } });
export const verifyEmailCode = (email: string, token: string, type: "signup" | "recovery") =>
  requestJson<AuthResult>("/api/auth/verify", { method: "POST", body: { email, token, type } });

type Callback = { action: "verify" | "session" | "exchange"; body: object; recovery: boolean };
export function readAuthCallback(url: URL, verifier?: string | null): Callback | null {
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (error) throw new Error("This sign-in link is invalid or expired. Request a new link.");
  const type = url.searchParams.get("type") ?? hash.get("type");
  const token = url.searchParams.get("token_hash");
  if (token) {
    if (!["email", "signup", "recovery", "email_change"].includes(type ?? "")) throw new Error("Unsupported confirmation link.");
    return { action: "verify", body: { token_hash: token, type }, recovery: type === "recovery" };
  }
  const access = hash.get("access_token");
  if (access) {
    const refresh = hash.get("refresh_token");
    if (!refresh) throw new Error("This sign-in link is incomplete. Request a new link.");
    return { action: "session", body: { access_token: access, refresh_token: refresh, expires_in: Number(hash.get("expires_in") ?? 3600) }, recovery: type === "recovery" };
  }
  const code = url.searchParams.get("code");
  if (code) {
    if (!verifier) throw new Error("Open this sign-in link in the browser where you started, or request a new link.");
    return { action: "exchange", body: { auth_code: code, code_verifier: verifier }, recovery: type === "recovery" };
  }
  return null;
}
export function cleanCallbackUrl(url: URL) {
  for (const key of ["token_hash", "type", "code", "error", "error_code", "error_description"]) url.searchParams.delete(key);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}
export const finishAuthCallback = (callback: Callback) =>
  requestJson<AuthResult>(`/api/auth/${callback.action}`, { method: "POST", body: callback.body });
