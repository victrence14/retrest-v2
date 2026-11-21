import type { Currency } from "@retrest/shared";
import { parseMinorAmount, sumMinorAmounts } from "@/lib/money";

/** A client representation of the seven actual columns in /api/export's CSV. */
export interface BusinessExpense {
  receiptId: string; date: string; merchant: string; amountMinor: number;
  currency: Currency; status: "APPROVED"; receiptUrl: string;
}
const columns = ["Receipt ID", "Date", "Merchant", "Amount", "Currency", "Status", "Receipt URL"];

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closedQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  function cell() { row.push(field); field = ""; closedQuote = false; }
  function line() { cell(); rows.push(row); row = []; }
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === ",") cell();
    else if (char === "\n" || char === "\r") { line(); if (char === "\r" && source[i + 1] === "\n") i++; }
    else if (char === '"' && !field && !closedQuote) quoted = true;
    else if (closedQuote || char === '"') throw new Error("Unreadable business export.");
    else field += char;
  }
  if (quoted) throw new Error("Incomplete business export.");
  if (field || row.length || closedQuote) line();
  return rows;
}

export function validMonth(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }

export function parseBusinessExport(text: string, month: string): BusinessExpense[] {
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  const rows = csvRows(text);
  if (!rows.length || rows[0].length !== columns.length || columns.some((name, index) => rows[0][index] !== name)) throw new Error("The business export schema has changed. Please contact the team.");
  const seen = new Set<string>();
  return rows.slice(1).map(row => {
    if (row.length !== columns.length) throw new Error("Incomplete business export row.");
    const [receiptId, date, merchant, amount, currency, status, receiptUrl] = row;
    const amountMinor = parseMinorAmount(amount);
    if (!receiptId || seen.has(receiptId) || !date.startsWith(`${month}-`) || Number.isNaN(Date.parse(date)) || amountMinor == null || (currency !== "NGN" && currency !== "USD") || status !== "APPROVED") throw new Error("The server returned an invalid business expense. No totals were calculated.");
    seen.add(receiptId);
    return { receiptId, date, merchant, amountMinor, currency, status, receiptUrl };
  });
}

/** Aggregate the complete server export, never the dashboard's truncated feed. */
export function businessTotals(rows: BusinessExpense[]): Record<Currency, number> {
  const NGN = sumMinorAmounts(rows.filter(row => row.currency === "NGN").map(row => row.amountMinor));
  const USD = sumMinorAmounts(rows.filter(row => row.currency === "USD").map(row => row.amountMinor));
  if (NGN == null || USD == null) throw new Error("Business totals exceed the supported amount range.");
  return { NGN, USD };
}
