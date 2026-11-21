import type { Dashboard, Transaction } from "../../lib/types";
import { authenticatedFile, requestJson } from "../shared/api.ts";

export const loadRecentTransactions = (signal?: AbortSignal) => requestJson<Dashboard>("/api/state", { signal });

export function receiptEligible(transaction: Pick<Transaction, "status" | "receipt_url">) {
  return transaction.status === "APPROVED" && !!transaction.receipt_url;
}

export async function loadReceipt(transaction: Pick<Transaction, "id" | "status" | "receipt_url">, signal?: AbortSignal) {
  if (!receiptEligible(transaction)) throw new Error("Only server-approved demo payments have receipts.");
  // Use the owned receipt route, never follow an arbitrary receipt_url or a bare download link.
  return authenticatedFile(`/api/receipts/${encodeURIComponent(transaction.id)}?format=pdf`, "application/pdf", signal);
}

export const transactionCapabilities = { serverPagination: false, liveSettlementStatus: false } as const;
