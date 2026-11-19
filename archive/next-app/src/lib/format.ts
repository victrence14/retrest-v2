import type { Currency } from "./types";

export const money = (minor: number, currency: Currency = "NGN", decimals = false) =>
  (currency === "NGN" ? "₦" : "$") + new Intl.NumberFormat("en-NG", { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 2 }).format(minor / 100);
export const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));
export const shortDate = (date: string) => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const relativeTime = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};
