import type { CreateSubscriptionInput, Currency, Dashboard, SubscriptionStatus } from "@retrest/shared";
import { requestJson } from "@/lib/api/client";

const subscriptionPath = (id: string) => `/api/subscriptions/${encodeURIComponent(id)}`;

/** Kill switch: PAUSED blocks every charge from this merchant. */
export const setSubscriptionStatus = (id: string, status: SubscriptionStatus) =>
  requestJson<Dashboard>(subscriptionPath(id), { method: "PATCH", body: { status } });

/** Price shield: the largest charge (minor units) this merchant may take. */
export const setMerchantLimit = (id: string, expected_max_amount: number) =>
  requestJson<Dashboard>(subscriptionPath(id), { method: "PATCH", body: { expected_max_amount } });

export const createSubscription = (body: CreateSubscriptionInput) =>
  requestJson<Dashboard>("/api/subscriptions", { method: "POST", body });

export const fundWallet = (currency: Currency, amount: number) =>
  requestJson<Dashboard>("/api/wallet", { method: "POST", body: { currency, amount } });
