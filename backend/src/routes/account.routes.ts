import { Router } from "express";
import type { AppContext } from "../context.ts";
import { dashboardFor } from "../context.ts";
import { MAX_FUNDING_AMOUNT } from "../constants.ts";
import { objectBody, sendError } from "../lib/http.ts";
import { balanceColumn, isCurrency, isMinorAmount } from "../lib/validation.ts";
import { requireDemo, requireSession, sessionUser } from "../middleware/session.ts";

/** Wallet funding and account preferences. */
export function accountRoutes(context: AppContext) {
  const { db, config } = context;
  const router = Router();
  const session = requireSession(config);

  router.post("/wallet", session, requireDemo(config, "Connect a payment provider to fund your wallet"), (request, response) => {
    const userId = sessionUser(response);
    const body = objectBody(request);
    if (!body || !isCurrency(body.currency) || !isMinorAmount(body.amount, MAX_FUNDING_AMOUNT))
      return sendError(response, 400, "Enter a valid amount");
    const column = balanceColumn(body.currency);
    db.prepare(`UPDATE users SET ${column}=${column}+? WHERE id=?`).run(body.amount, userId);
    response.json(dashboardFor(context, userId));
  });

  router.patch("/settings", session, (request, response) => {
    const userId = sessionUser(response);
    const body = objectBody(request);
    if (!body || typeof body.auto_fx_enabled !== "boolean") return sendError(response, 400, "Invalid setting");
    db.prepare("UPDATE users SET auto_fx_enabled=? WHERE id=?").run(Number(body.auto_fx_enabled), userId);
    response.json(dashboardFor(context, userId));
  });

  return router;
}
