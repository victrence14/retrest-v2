import type { Transaction } from "@retrest/shared";
import { authenticatedFile } from "@/lib/api/client";

export function receiptEligible(transaction: Pick<Transaction, "status" | "receipt_url">) {
  return transaction.status === "APPROVED" && !!transaction.receipt_url;
}

export async function loadReceipt(transaction: Pick<Transaction, "id" | "status" | "receipt_url">, signal?: AbortSignal) {
  if (!receiptEligible(transaction)) throw new Error("Only server-approved demo payments have receipts.");
  // Use the owned receipt route, never follow an arbitrary receipt_url or a bare download link.
  return authenticatedFile(`/api/receipts/${encodeURIComponent(transaction.id)}?format=pdf`, "application/pdf", signal);
}
