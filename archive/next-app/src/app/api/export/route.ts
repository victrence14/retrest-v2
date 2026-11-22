import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/api";
import { makePdf } from "@/lib/documents";
import type { Transaction } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const month =
    url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return Response.json({ error: "Invalid month" }, { status: 400 });
  const rows = getDb()
    .prepare(
      "SELECT t.* FROM transaction_logs t JOIN merchant_subscriptions s ON s.id=t.subscription_id WHERE t.user_id=? AND s.is_business_expense=1 AND t.status='APPROVED' AND substr(t.created_at,1,7)=? ORDER BY t.created_at DESC",
    )
    .all(auth.userId, month) as unknown as Transaction[];
  if (url.searchParams.get("format") === "pdf") {
    const lines = [
      "RETREST / BUSINESS EXPENSE RECEIPT PACK",
      `Statement month: ${month}`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      "",
      ...rows.flatMap((t) => [
        t.merchant_name,
        `${t.created_at.slice(0, 10)} | ${t.currency} ${(t.amount / 100).toFixed(2)} | APPROVED`,
        `Receipt: ${t.id}`,
        "",
      ]),
      `Total receipts: ${rows.length}`,
      "Generated from settled RETREST transactions. Demo environment.",
    ];
    return new Response(new Uint8Array(makePdf(lines)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="retrest-receipts-${month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const quote = (value: unknown) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const csv = [
    [
      "Receipt ID",
      "Date",
      "Merchant",
      "Amount",
      "Currency",
      "Status",
      "Receipt URL",
    ],
    ...rows.map((t) => [
      t.id,
      t.created_at,
      t.merchant_name,
      (t.amount / 100).toFixed(2),
      t.currency,
      t.status,
      t.receipt_url,
    ]),
  ]
    .map((row) => row.map(quote).join(","))
    .join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="retrest-receipts-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
