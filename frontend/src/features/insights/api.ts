import { authenticatedFile, saveFile } from "@/lib/api/client";
import { businessTotals, parseBusinessExport, validMonth } from "./business-export";

function exportPath(month: string, format: "csv" | "pdf") {
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  return `/api/export?month=${encodeURIComponent(month)}&format=${format}`;
}

export async function loadBusinessExpenses(month: string, signal?: AbortSignal) {
  const csv = await authenticatedFile(exportPath(month, "csv"), "text/csv", signal);
  const rows = parseBusinessExport(await csv.text(), month);
  businessTotals(rows); // Reject unsupported totals before exposing any report values.
  return rows;
}

export async function downloadBusinessExport(month: string, format: "csv" | "pdf") {
  const file = await authenticatedFile(exportPath(month, format), format === "pdf" ? "application/pdf" : "text/csv");
  saveFile(file, `retrest-receipts-${month}.${format}`);
}
