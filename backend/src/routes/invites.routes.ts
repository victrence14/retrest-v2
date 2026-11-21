import { Router } from "express";
import { money, type Currency, type InviteSummary } from "@retrest/shared";
import type { AppContext } from "../context.ts";
import { transaction } from "../db/database.ts";
import { HttpError, objectBody, sendError, sendFailure } from "../lib/http.ts";
import { requireDemo } from "../middleware/session.ts";
import { settleContribution } from "./pools.routes.ts";

/** Public pool invitations: anyone with the link can view it and (in demo mode) contribute. */
export function inviteRoutes(context: AppContext) {
  const { db, config } = context;
  const router = Router();

  router.get("/:token", (request, response) => {
    const pool = db
      .prepare(
        "SELECT p.name,p.target_amount,p.currency,p.pool_balance,s.merchant_name,s.next_billing_date,u.name host_name FROM split_pools p JOIN merchant_subscriptions s ON s.id=p.subscription_id JOIN users u ON u.id=p.host_user_id WHERE p.invite_token=?",
      )
      .get(String(request.params.token));
    if (!pool) return sendError(response, 404, "Invitation not found");
    const summary: InviteSummary = {
      name: String(pool.name),
      host_name: String(pool.host_name),
      merchant_name: String(pool.merchant_name),
      target_amount: Number(pool.target_amount),
      pool_balance: Number(pool.pool_balance),
      currency: pool.currency as Currency,
      next_billing_date: String(pool.next_billing_date),
      demo_enabled: config.demoEnabled,
    };
    response.json(summary);
  });

  router.post("/:token", requireDemo(config, "Demo contributions unavailable"), (request, response) => {
    const body = objectBody(request);
    if (!body || typeof body.email !== "string") return sendError(response, 400, "Enter your invited email");
    const email = body.email.trim().toLowerCase();
    try {
      const message = transaction(db, () => {
        const member = db
          .prepare(
            "SELECT m.*,p.currency FROM pool_members m JOIN split_pools p ON p.id=m.pool_id WHERE p.invite_token=? AND m.email=?",
          )
          .get(String(request.params.token), email);
        if (!member) throw new HttpError(404, "This email is not on the invite list. Ask your host to check the address.");
        if (member.payment_status === "PAID") return "You’re all paid up. Your contribution is already in the pool.";
        settleContribution(db, member, member.currency, "Your demo wallet has insufficient funds.");
        return `Your ${money(Number(member.share_amount), member.currency as Currency)} demo contribution is in. You’re good to go.`;
      });
      response.json({ message });
    } catch (error) {
      sendFailure(response, error, "Could not settle contribution");
    }
  });

  return router;
}
