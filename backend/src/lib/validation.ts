import type { Currency } from "@retrest/shared";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isCurrency = (value: unknown): value is Currency => value === "NGN" || value === "USD";

/** A positive safe integer of minor units no larger than `max`. */
export const isMinorAmount = (value: unknown, max: number): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= max;

export const balanceColumn = (currency: unknown) => (currency === "USD" ? "usd_balance" : "ngn_balance");
