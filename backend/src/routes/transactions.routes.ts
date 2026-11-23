import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../context.ts";
import { requireSession, sessionUser } from "../middleware/session.ts";
import { booleanQuery, currency, listQuery, month, parse, timestamp, transactionRange } from "../lib/feature-validation.ts";
import { demoPeriodSummary, demoTransactionsPage } from "../services/demo-transactions.ts";

/** Complete queries for the existing cookie-authenticated demo UI. */
export function demoTransactionRoutes({ db, config }: AppContext) {
  const router = Router();
  router.use("/transactions", requireSession(config));
  const querySchema = listQuery.extend({
    month: month.optional(), from: timestamp.optional(), to: timestamp.optional(),
    currency: currency.optional(), business: booleanQuery.optional(),
    status: z.enum(["APPROVED", "DECLINED_KILL_SWITCH", "DECLINED_PRICE_HIKE", "DECLINED_INSUFFICIENT_FUNDS",
      "DECLINED_UNKNOWN_MERCHANT", "DECLINED_CURRENCY_MISMATCH", "DECLINED_CARD_FROZEN"]).optional(),
  }).refine(value => !(value.month && (value.from || value.to))).refine(value => !value.from || !value.to || value.from < value.to);
  router.get("/transactions", (request, response) => {
    const input = parse(querySchema, request.query);
    response.json(demoTransactionsPage(db, sessionUser(response), { ...input, ...transactionRange(input) }));
  });
  router.get("/transactions/summary", (request, response) => {
    const input = parse(querySchema, request.query);
    const period = transactionRange({ ...input, month: input.month ?? (!input.from && !input.to ? new Date().toISOString().slice(0, 7) : undefined) });
    if (!period.from || !period.to) return response.status(400).json({ error: "Supply month or both from and to." });
    response.json({ ...period, totals: demoPeriodSummary(db, sessionUser(response), { ...input, ...period }) });
  });
  return router;
}
