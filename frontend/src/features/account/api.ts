import type {
  AccountInvite, AccountNotification, AccountUser, CategoryRecord, ContributionRecord, DeviceRecord,
  EmailJobRecord, InviteRecord, MonthlySummaryRecord, Page, PeriodSummary, PoolInput, PoolMemberRecord,
  PoolRecord, ProfileRecord, SettingsPatch, SettingsRecord, SubscriptionInput, SubscriptionRecord,
  SupportMessageRecord, SupportThreadRecord, TransactionRecord,
} from "@retrest/shared";
import { ApiError, authenticatedFile, requestJson } from "@/lib/api/client";

export type Filters = Record<string, string | number | boolean | undefined>;
export function accountQuery(path: string, filters: Filters = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") search.set(key, String(value));
  return `/api/v1/${path}${search.size ? `?${search}` : ""}`;
}
export async function accountPage<T>(path: string, filters: Filters = {}, signal?: AbortSignal): Promise<Page<T>> {
  const value = await requestJson<Page<T>>(accountQuery(path, filters), { signal });
  if (!value || !Array.isArray(value.data) || !(value.next_cursor === null || typeof value.next_cursor === "string"))
    throw new ApiError("The server returned an invalid collection.");
  return value;
}
const item = (resource: string, id: string) => `/api/v1/${resource}/${encodeURIComponent(id)}`;
const keyed = (key: string) => ({ "Idempotency-Key": key });

export const getAccountUser = (signal?: AbortSignal) => requestJson<{ user: AccountUser }>("/api/v1/me", { signal });
export const getAccountProfile = (signal?: AbortSignal) => requestJson<{ profile: ProfileRecord }>("/api/v1/profile", { signal });
export const updateAccountProfile = (display_name: string) => requestJson<{ profile: ProfileRecord }>("/api/v1/profile", { method: "PATCH", body: { display_name } });
export const getAccountSettings = (signal?: AbortSignal) => requestJson<{ settings: SettingsRecord }>("/api/v1/settings", { signal });
export const updateAccountSettings = (body: SettingsPatch) => requestJson<{ settings: SettingsRecord }>("/api/v1/settings", { method: "PATCH", body });
export const getCategories = () => requestJson<{ data: CategoryRecord[] }>("/api/v1/subscriptions/categories");
export const addAccountSubscription = (body: SubscriptionInput) => requestJson<{ subscription: SubscriptionRecord }>("/api/v1/subscriptions", { method: "POST", body });
export const updateAccountSubscription = (id: string, body: Partial<SubscriptionInput>) => requestJson<{ subscription: SubscriptionRecord }>(item("subscriptions", id), { method: "PATCH", body });
export const addAccountPool = (body: PoolInput) => requestJson<{ pool: PoolRecord; members: PoolMemberRecord[] }>("/api/v1/pools", { method: "POST", body });
export const getAccountPool = (id: string) => requestJson<{ pool: PoolRecord; members: PoolMemberRecord[] }>(item("pools", id));
export const updateAccountPool = (id: string, body: { name?: string; fallback_enabled?: boolean; status?: "ACTIVE" | "CLOSED" }) => requestJson<{ pool: PoolRecord }>(item("pools", id), { method: "PATCH", body });
export const createAccountInvite = (poolId: string, member_id: string) => requestJson<{ invite: InviteRecord; token: string; path: string }>(`${item("pools", poolId)}/invites`, { method: "POST", body: { member_id } });
export const revokeAccountInvite = (id: string) => requestJson<{ ok: true }>(item("invites", id), { method: "DELETE" });
export const getAccountInvite = (token: string, signal?: AbortSignal) => requestJson<AccountInvite>(item("invites", token), { signal });
export const acceptAccountInvite = (token: string) => requestJson<AccountInvite>(`${item("invites", token)}/accept`, { method: "POST" });
export const contributeToAccountPool = (poolId: string, key: string) => requestJson<{ contribution: ContributionRecord; replayed: boolean }>(`${item("pools", poolId)}/contributions`, { method: "POST", headers: keyed(key) });
export const getAccountContribution = (id: string, signal?: AbortSignal) => requestJson<{ contribution: ContributionRecord }>(item("contributions", id), { signal });
export const getAccountTransaction = (id: string) => requestJson<{ transaction: TransactionRecord }>(item("transactions", id));
export const getAccountInsights = (month: string, business?: boolean, signal?: AbortSignal) => requestJson<PeriodSummary>(accountQuery("insights/summary", { month, business }), { signal });
export const registerAccountDevice = (name: string) => requestJson<{ device: DeviceRecord }>("/api/v1/devices", { method: "POST", body: { name } });
export const removeAccountDevice = (id: string) => requestJson<{ device: DeviceRecord }>(item("devices", id), { method: "DELETE" });
export const readAccountNotifications = (filters: Filters = {}, signal?: AbortSignal) => requestJson<Page<AccountNotification> & { unread_count: number }>(accountQuery("notifications", filters), { signal });
export const markAccountNotificationsRead = (body: { all: true } | { ids: string[] }) => requestJson<{ updated: number }>("/api/v1/notifications/read", { method: "PATCH", body });
export const supportAvailability = () => requestJson<{ accepting_messages: boolean; response_mode: "asynchronous" }>("/api/v1/support/availability");
export const getAccountSupportThread = (id: string) => requestJson<{ thread: SupportThreadRecord }>(item("support/threads", id));
export const createAccountSupportThread = (subject: string, body: string, key: string) => requestJson<{ thread: SupportThreadRecord; message: SupportMessageRecord; replayed: boolean }>("/api/v1/support/threads", { method: "POST", body: { subject, body }, headers: keyed(key) });
export const sendAccountSupportMessage = (id: string, body: string, key: string) => requestJson<{ message: SupportMessageRecord; replayed: boolean }>(`${item("support/threads", id)}/messages`, { method: "POST", body: { body }, headers: keyed(key) });
export const updateAccountSupportThread = (id: string, status: "OPEN" | "CLOSED") => requestJson<{ thread: SupportThreadRecord }>(item("support/threads", id), { method: "PATCH", body: { status } });
export const generateAccountSummary = (month: string) => requestJson<{ summary: MonthlySummaryRecord }>("/api/v1/summaries", { method: "POST", body: { month } });
export const emailAccountSummary = (id: string, key: string) => requestJson<{ job: EmailJobRecord }>(`${item("summaries", id)}/email`, { method: "POST", headers: keyed(key) });
export const getAccountEmailJob = (id: string) => requestJson<{ job: EmailJobRecord }>(item("email-jobs", id));
export function accountReceipt(record: Pick<TransactionRecord, "id" | "status">) {
  if (record.status !== "SETTLED") throw new ApiError("Only settled payments have receipts.");
  return authenticatedFile(`${item("receipts", record.id)}?format=pdf`, "application/pdf");
}
export function accountExport(month: string, format: "csv" | "pdf") {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError("Choose a valid month.");
  return authenticatedFile(accountQuery("export", { month, format }), format === "pdf" ? "application/pdf" : "text/csv");
}
export function exactAccountMoney(minor: string, currency: string) {
  if (!/^\d+$/.test(minor)) throw new ApiError("The server returned an invalid amount.");
  const amount = BigInt(minor);
  return `${currency === "NGN" ? "₦" : "$"}${(amount / 100n).toLocaleString("en-NG")}.${(amount % 100n).toString().padStart(2, "0")}`;
}
