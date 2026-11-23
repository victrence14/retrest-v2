import type { Page } from "@playwright/test";
import type { AccountNotification, AccountUser, DeviceRecord, ProfileRecord, SettingsRecord } from "@retrest/shared";

/** Browser-only fixtures: no auth or account request reaches a hosted database. */
export async function mockAccount(page: Page, theme: SettingsRecord["theme"] = "system") {
  const user: AccountUser = { id: "10000000-0000-4000-8000-000000000001", email: "amina@example.test", email_verified: true };
  const timestamp = "2026-11-23T10:00:00Z";
  const profile: ProfileRecord = { id: user.id, display_name: "Amina Bello", created_at: timestamp, updated_at: timestamp };
  const settings: SettingsRecord = {
    user_id: user.id, theme, phone: null, time_zone: "Africa/Lagos", auto_fx_enabled: true,
    email_notifications: true, monthly_summary_email: false, updated_at: timestamp,
  };
  const notifications: AccountNotification[] = [{
    id: "20000000-0000-4000-8000-000000000001", title: "Your account is ready", message: "Welcome to your account.",
    read_at: null, created_at: timestamp, resource_type: null, resource_id: null,
  }];
  const devices: DeviceRecord[] = [];
  const requests: { path: string; method: string; body: Record<string, unknown> | null }[] = [];
  const replies = new Map<string, { status: number; json: object }>();
  const origin = process.env.TEST_ORIGIN ?? "http://localhost:3000";
  const authenticate = () => page.context().addCookies(["retrest_account_access", "__Host-retrest_account_access"].map(name => ({
    name, value: "ui-fixture-session", url: name.startsWith("__Host-") ? origin.replace(/^http:/, "https:") : origin,
    secure: name.startsWith("__Host-"), httpOnly: true, sameSite: "Lax" as const,
  })));

  await page.route(/\/api\/(?:auth|v1)\//, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    requests.push({ path, method, body });
    const key = method + " " + path;
    const reply = replies.get(key);
    if (reply) {
      replies.delete(key);
      await route.fulfill(reply);
      return;
    }
    let json: object;
    let status = 200;
    if (["/api/auth/login", "/api/auth/verify", "/api/auth/session", "/api/auth/exchange"].includes(path)) {
      await authenticate(); json = { user };
    } else if (path === "/api/auth/signup" || path === "/api/auth/email") {
      status = 202; json = { confirmation_required: true };
    } else if (["/api/auth/forgot-password", "/api/auth/resend-confirmation"].includes(path)) {
      status = 202; json = { ok: true };
    } else if (path === "/api/auth/password") {
      json = { ok: true };
    } else if (path === "/api/auth/logout") {
      await page.context().clearCookies(); json = { ok: true };
    } else if (path === "/api/v1/me") {
      json = { user };
    } else if (path === "/api/v1/profile") {
      if (method === "PATCH") profile.display_name = String(body?.display_name);
      json = { profile };
    } else if (path === "/api/v1/settings") {
      if (method === "PATCH") Object.assign(settings, body);
      json = { settings };
    } else if (path === "/api/v1/devices") {
      if (method === "POST") {
        const device: DeviceRecord = {
          id: "30000000-0000-4000-8000-000000000001", name: String(body?.name),
          created_at: timestamp, last_used_at: timestamp, expires_at: "2026-12-23T10:00:00Z", revoked_at: null,
        };
        devices.push(device); status = 201; json = { device };
      } else json = { data: devices, next_cursor: null };
    } else if (path === "/api/v1/notifications/read") {
      notifications.forEach(record => { record.read_at = timestamp; }); json = { ok: true };
    } else if (path === "/api/v1/notifications") {
      const onlyUnread = new URL(request.url()).searchParams.get("unread") === "true";
      json = { data: onlyUnread ? notifications.filter(record => !record.read_at) : notifications,
        next_cursor: null, unread_count: notifications.filter(record => !record.read_at).length };
    } else if (["/api/v1/subscriptions", "/api/v1/categories"].includes(path)) {
      json = { data: [], next_cursor: null };
    } else {
      status = 503; json = { error: "This browser fixture does not implement that request." };
    }
    await route.fulfill({ status, json });
  });

  return { requests, settings, authenticate,
    replyNext: (method: string, path: string, status: number, json: object) => replies.set(method + " " + path, { status, json }) };
}
