import type { SupabaseConfig } from "../config.ts";
import { HttpError } from "../lib/http.ts";

export interface AuthGateway {
  request(method: "POST" | "PUT", path: string, body?: object, token?: string): Promise<Record<string, unknown>>;
}

// Explain known failures without forwarding provider text, credentials, or account details.
const providerErrors = new Map<string, { status: number; message: string }>([
  ["same_password", { status: 400, message: "Choose a new password that is different from your current password." }],
  ["weak_password", { status: 400, message: "This password was rejected by the security policy. Choose a unique password of at least 12 characters with letters, numbers, and symbols." }],
  ["otp_expired", { status: 400, message: "This verification code or email link is invalid or expired. Request a new email and use its latest code or link." }],
  ["flow_state_expired", { status: 400, message: "This sign-in link has expired. Request a new email link." }],
  ["flow_state_not_found", { status: 400, message: "This sign-in link is invalid or has already been used. Request a new email link." }],
  ["bad_code_verifier", { status: 400, message: "Open this email link in the browser where you requested it, or request a new link." }],
  ["reauthentication_needed", { status: 401, message: "Verify a fresh password recovery email link before changing your password." }],
  ["reauthentication_not_valid", { status: 401, message: "Your password recovery verification is invalid or expired. Request a new recovery email." }],
  ["session_not_found", { status: 401, message: "Your sign-in session has ended. Log in again or open a fresh password recovery link." }],
  ["session_expired", { status: 401, message: "Your sign-in session has expired. Log in again or open a fresh password recovery link." }],
]);

/** Request-scoped REST calls avoid sharing an SDK's mutable login session across users. */
export function createAuthGateway(config: SupabaseConfig, transport: typeof fetch = fetch): AuthGateway {
  return {
    async request(method, path, body, token) {
      let response: Response;
      try {
        response = await transport(`${config.url.replace(/\/$/, "")}/auth/v1/${path}`, {
          method, headers: { apikey: config.anonKey, "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(10_000),
        });
      } catch { throw new HttpError(503, "Authentication provider temporarily unavailable."); }
      if (response.status === 429) throw new HttpError(429, "Too many authentication requests. Try again later.");
      if (response.status >= 500) throw new HttpError(503, "Authentication provider temporarily unavailable.");
      if (!response.ok) {
        let failure: unknown;
        try { failure = await response.json(); } catch { /* Unknown provider responses use the safe fallback. */ }
        const fields = failure && typeof failure === "object" ? failure as Record<string, unknown> : {};
        // GoTrue uses error_code in legacy responses and code in newer API versions.
        const code = typeof fields.code === "string" ? fields.code
          : typeof fields.error_code === "string" ? fields.error_code : "unknown";
        const reason = providerErrors.get(code);
        console.warn(JSON.stringify({ event: "auth_provider_rejected", operation: path.split("?")[0],
          status: response.status, code: reason ? code : "unknown" }));
        throw new HttpError(reason?.status ?? (response.status === 401 || response.status === 403 ? 401 : 400),
          reason?.message ?? "Authentication request rejected. Check your credentials or confirmation link.");
      }
      if (response.status === 204) return {};
      let value: unknown;
      try { value = await response.json(); } catch { throw new HttpError(503, "Invalid authentication provider response."); }
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new HttpError(503, "Invalid authentication provider response.");
      return value as Record<string, unknown>;
    },
  };
}
