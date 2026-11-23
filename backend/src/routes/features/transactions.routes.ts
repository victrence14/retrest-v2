import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { z } from "zod";
import type { Transaction } from "@retrest/shared";
import type { TransactionRecord } from "../../contracts/features.ts";
import { authContext } from "../../middleware/supabase-auth.ts";
import { databaseResult } from "../../lib/database-result.ts";
import { id, month, parse, transactionQuery } from "../../lib/feature-validation.ts";
import { HttpError } from "../../lib/http.ts";
import { businessTransactions, transactionsPage, TRANSACTION_COLUMNS } from "../../services/transactions.ts";
import { businessExportCsv, makePdf, minorDecimal, receiptHtml } from "../../services/documents.ts";

function documentRecord(row: TransactionRecord): Transaction {
  return { ...row, authorization_id: row.provider_transaction_id, amount: row.amount_minor,
    is_business_expense: Number(row.is_business_expense), receipt_url: `/api/v1/receipts/${row.id}` };
}
export function transactionFeatureRoutes() {
  const router = Router();
  router.get("/transactions", async (request, response) => {
    const { db, user } = authContext(response);
    response.json(await transactionsPage(db, user.id, parse(transactionQuery, request.query)));
  });
  router.get("/transactions/:id", async (request, response) => {
    const transactionId = parse(id, request.params.id);
    const { db, user } = authContext(response);
    const transaction = databaseResult<TransactionRecord>(await db.from("transactions").select(TRANSACTION_COLUMNS).eq("id", transactionId).eq("user_id", user.id).single());
    response.json({ transaction: { ...transaction, receipt_url: transaction.status === "SETTLED" ? `/api/v1/receipts/${transaction.id}` : null } });
  });
  router.get("/receipts/:id", async (request, response) => {
    const transactionId = parse(id, request.params.id);
    const input = parse(z.object({ format: z.enum(["html", "pdf"]).default("html") }).strict(), request.query);
    const { db, user } = authContext(response);
    const transaction = databaseResult<TransactionRecord>(await db.from("transactions").select(TRANSACTION_COLUMNS)
      .eq("id", transactionId).eq("user_id", user.id).eq("status", "SETTLED").single());
    if (input.format === "pdf") {
      response.type("application/pdf").attachment(`retrest-receipt-${transactionId}.pdf`).send(makePdf([
        "RETREST / PAYMENT RECEIPT", transaction.merchant_name,
        `Amount: ${transaction.currency} ${minorDecimal(transaction.amount_minor)}`, "Status: SETTLED",
        `Settled: ${transaction.settled_at}`, `Receipt ID: ${transaction.id}`,
        `FX: NGN ${minorDecimal(transaction.fx_ngn_amount)}`,
        `Pool: ${transaction.currency} ${minorDecimal(transaction.pool_amount)}`,
      ]));
    } else response.type("text/html; charset=utf-8").send(receiptHtml({
      ...documentRecord(transaction), created_at: transaction.settled_at ?? transaction.created_at,
    }, { demo: false }));
  });
  router.get("/export", async (request, response) => {
    const input = parse(z.object({
      month: month.default(new Date().toISOString().slice(0, 7)), format: z.enum(["csv", "pdf"]).default("csv"),
    }).strict(), request.query);
    const { db, user } = authContext(response);
    const records = businessTransactions(db, user.id, input.month);
    if (input.format === "pdf") {
      const lines = ["RETREST / BUSINESS EXPENSE RECEIPT PACK", `Statement month (UTC): ${input.month}`, ""];
      let count = 0;
      for await (const row of records) {
        if (++count > 5000) throw new HttpError(413, "PDF exports support up to 5,000 receipts. Use CSV for larger periods.");
        lines.push(row.merchant_name, `${row.created_at.slice(0, 10)} | ${row.currency} ${minorDecimal(row.amount_minor)} | SETTLED`, `Receipt: ${row.id}`, "");
      }
      lines.push(`Total receipts: ${count}`, "Only confirmed, settled business payments are included.");
      response.type("application/pdf").attachment(`retrest-receipts-${input.month}.pdf`).send(makePdf(lines));
      return;
    }
    // Fetch before committing headers; initial database failures remain normal JSON errors.
    const first = await records.next();
    async function* csv() {
      yield businessExportCsv([]) + "\r\n";
      if (!first.done) yield businessExportCsv([documentRecord(first.value)]).split("\r\n").slice(1).join("\r\n") + "\r\n";
      for await (const row of records) yield businessExportCsv([documentRecord(row)]).split("\r\n").slice(1).join("\r\n") + "\r\n";
    }
    response.type("text/csv; charset=utf-8").attachment(`retrest-receipts-${input.month}.csv`);
    try { await pipeline(Readable.from(csv()), response); }
    finally { await records.return(undefined); }
  });
  return router;
}
