import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppContext } from "../context.ts";
import { dashboardFor } from "../context.ts";
import { MAX_FUNDING_AMOUNT, MAX_MERCHANT_LIMIT } from "../constants.ts";
import { transaction } from "../db/database.ts";
import { objectBody, sendError, sendFailure } from "../lib/http.ts";
import { isCurrency, isMinorAmount } from "../lib/validation.ts";
import { requireSession, sessionUser } from "../middleware/session.ts";

const DESCRIPTOR_PATTERN = /^[A-Z0-9 _.-]{2,60}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function subscriptionRoutes(context: AppContext) {
  const { db, config } = context;
  const router = Router();
  router.use(requireSession(config));

  // Connect a merchant and create its matching merchant rule.
  router.post("/", (request, response) => {
    const userId = sessionUser(response);
    const body = objectBody(request);
    if (
      !body ||
      typeof body.merchant_name !== "string" ||
      !body.merchant_name.trim() ||
      body.merchant_name.length > 60 ||
      typeof body.merchant_descriptor !== "string" ||
      !DESCRIPTOR_PATTERN.test(body.merchant_descriptor) ||
      !isMinorAmount(body.expected_amount, MAX_FUNDING_AMOUNT) ||
      !isCurrency(body.currency) ||
      typeof body.next_billing_date !== "string" ||
      !DATE_PATTERN.test(body.next_billing_date) ||
      Number.isNaN(new Date(body.next_billing_date).getTime())
    )
      return sendError(response, 400, "Enter a merchant, amount, currency, and renewal date");

    const descriptor = body.merchant_descriptor.trim();
    if (db.prepare("SELECT id FROM merchant_subscriptions WHERE user_id=? AND merchant_descriptor=?").get(userId, descriptor))
      return sendError(response, 409, "This merchant is already connected");

    const id = randomUUID();
    const amount = body.expected_amount;
    try {
      transaction(db, () => {
        db.prepare(
          "INSERT INTO merchant_subscriptions (id,user_id,merchant_name,merchant_descriptor,category,status,expected_amount,expected_max_amount,currency,next_billing_date,plan_name,is_business_expense) VALUES (?,?,?,?,?,'ACTIVE',?,?,?,?,?,?)",
        ).run(
          id,
          userId,
          String(body.merchant_name).trim(),
          descriptor,
          "Other",
          amount,
          amount,
          String(body.currency),
          new Date(String(body.next_billing_date)).toISOString(),
          "Monthly subscription",
          Number(body.is_business_expense === true),
        );
        db.prepare(
          "INSERT INTO merchant_rules (id,subscription_id,user_id,merchant_descriptor,status,expected_max_amount) VALUES (?,?,?,?,'ACTIVE',?)",
        ).run(randomUUID(), id, userId, descriptor, amount);
      });
    } catch (error) {
      return sendFailure(response, error, "Could not connect merchant");
    }
    response.json(dashboardFor(context, userId));
  });

  // Kill switch (status) and/or price limit (expected_max_amount).
  router.patch("/:id", (request, response) => {
    const userId = sessionUser(response);
    const id = String(request.params.id);
    const body = objectBody(request);
    const status = body?.status;
    const setsStatus = status === "ACTIVE" || status === "PAUSED";
    if (!body || (!setsStatus && body.expected_max_amount === undefined))
      return sendError(response, 400, "Invalid merchant rule");

    const subscription = db.prepare("SELECT * FROM merchant_subscriptions WHERE id=? AND user_id=?").get(id, userId);
    if (!subscription) return sendError(response, 404, "Subscription not found");

    const maximum = body.expected_max_amount;
    if (
      maximum !== undefined &&
      (!Number.isSafeInteger(maximum) ||
        Number(maximum) < Number(subscription.expected_amount) ||
        Number(maximum) > MAX_MERCHANT_LIMIT)
    )
      return sendError(response, 400, "Maximum must be an integer at least equal to the expected amount");

    try {
      transaction(db, () => {
        if (setsStatus) {
          db.prepare(
            "UPDATE merchant_subscriptions SET status=?,needs_review=CASE WHEN ?='PAUSED' THEN 0 ELSE needs_review END WHERE id=?",
          ).run(status, status, id);
          db.prepare("UPDATE merchant_rules SET status=? WHERE subscription_id=?").run(status, id);
        }
        if (maximum !== undefined) {
          db.prepare("UPDATE merchant_subscriptions SET expected_max_amount=? WHERE id=?").run(Number(maximum), id);
          db.prepare("UPDATE merchant_rules SET expected_max_amount=? WHERE subscription_id=?").run(Number(maximum), id);
          // Approving a new limit resolves that merchant's price-hike notifications.
          db.prepare("UPDATE notifications SET read_at=? WHERE subscription_id=? AND user_id=?").run(
            new Date().toISOString(),
            id,
            userId,
          );
        }
      });
    } catch (error) {
      return sendFailure(response, error, "Could not save merchant rule");
    }
    response.json(dashboardFor(context, userId));
  });

  return router;
}
